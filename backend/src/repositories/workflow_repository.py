"""Persistencia del flujo municipal. Cada escritura de negocio es transaccional."""
from fastapi import HTTPException
from psycopg import sql
from backend.database import connection
from backend.services.report_photo import prepare_photo


def require(condition, message, status=409):
    if not condition:
        raise HTTPException(status,message)


def lock(conn):
    # Serializa asignaciones, cambios de recursos y transiciones, incluso entre procesos.
    conn.execute('SELECT pg_advisory_xact_lock(728401)')


def one(conn, table, key, identifier):
    row=conn.execute(sql.SQL('SELECT * FROM public.{} WHERE {}=%s FOR UPDATE').format(sql.Identifier(table),sql.Identifier(key)),(identifier,)).fetchone()
    require(row is not None,'No se encontró el registro.',404)
    return row


REPORT_SELECT='''SELECT r.*,t."nombreTipo",p."nombrePrioridad",p.orden,
 e."nombreEstado",concat(per.nombres,' ',per.apellidos) AS reportante
 FROM public."REPORTE_INCIDENCIA" r
 JOIN public."TIPO_RESIDUO" t ON t."idTipoResiduo"=r."idTipoResiduo"
 JOIN public."ESTADO_REPORTE" e ON e."idEstadoReporte"=r."idEstadoReporte"
 LEFT JOIN public."PRIORIDAD" p ON p."idPrioridad"=r."idPrioridad"
 JOIN public."USUARIO_SISTEMA" u ON u."idUsuario"=r."idUsuarioReportante"
 JOIN public."Persona" per ON per."idPersona"=u."idPersona"'''

CATALOGS={
 'tipos':('TIPO_RESIDUO','idTipoResiduo','nombreTipo'),
 'prioridades':('PRIORIDAD','idPrioridad','nombrePrioridad'),
 'estados':('ESTADO_REPORTE','idEstadoReporte','nombreEstado'),
}


class WorkflowRepository:
    def catalogs(self, include_inactive=False):
        with connection() as conn:
            result={}
            for name,(table,key,label) in CATALOGS.items():
                result[name]=conn.execute(sql.SQL('SELECT * FROM public.{} {} ORDER BY {}').format(
                    sql.Identifier(table),sql.SQL('' if include_inactive else 'WHERE activo'),sql.Identifier('orden' if name=='prioridades' else key))).fetchall()
            return result

    def save_catalog(self,kind,data,identifier=None):
        require(kind in CATALOGS,'Catálogo desconocido.',404)
        table,key,label=CATALOGS[kind]
        with connection() as conn:
            lock(conn)
            if kind=='estados':
                require(identifier is not None,'Los estados del flujo ya están definidos.')
                old=one(conn,table,key,identifier)
                require(data['nombre']==old[label] and data['activo'],'Los estados pendiente, en proceso y resuelto deben conservar su nombre y permanecer activos.')
                return old
            fields={label:data['nombre'],'activo':data['activo']}
            if kind=='tipos':fields['descripcion']=data['descripcion']
            if kind=='prioridades':fields['orden']=data['orden']
            if identifier:
                one(conn,table,key,identifier)
                return conn.execute(sql.SQL('UPDATE public.{} SET {} WHERE {}=%s RETURNING *').format(sql.Identifier(table),sql.SQL(',').join(sql.SQL('{}=%s').format(sql.Identifier(k)) for k in fields),sql.Identifier(key)),(*fields.values(),identifier)).fetchone()
            return conn.execute(sql.SQL('INSERT INTO public.{} ({}) VALUES ({}) RETURNING *').format(sql.Identifier(table),sql.SQL(',').join(map(sql.Identifier,fields)),sql.SQL(',').join(sql.Placeholder() for _ in fields)),tuple(fields.values())).fetchone()

    def reports(self,user):
        with connection() as conn:
            if user['rol']=='ciudadano':
                clause=' WHERE r."idUsuarioReportante"=%s';params=(user['idUsuario'],)
            elif user['rol']=='cuadrilla':
                clause=''' WHERE EXISTS (SELECT 1 FROM public."ATENCION_LIMPIEZA" a JOIN public."PERTENENCIA_CUADRILLA" m ON m."idCuadrilla"=a."idCuadrilla"
                WHERE a."idReporte"=r."idReporte" AND m."idUsuario"=%s AND m."fechaInicio"<=now() AND (m."fechaFin" IS NULL OR m."fechaFin">now()))''';params=(user['idUsuario'],)
            else:clause='';params=()
            return conn.execute(REPORT_SELECT+clause+' ORDER BY r."fechaReporte" DESC LIMIT 1000',params).fetchall()

    def can_read(self,conn,report_id,user):
        row=one(conn,'REPORTE_INCIDENCIA','idReporte',report_id)
        if user['rol']=='ciudadano':
            require(row['idUsuarioReportante']==user['idUsuario'],'No tienes acceso a este reporte.',403)
        if user['rol']=='cuadrilla':
            found=conn.execute('''SELECT 1 FROM public."ATENCION_LIMPIEZA" a JOIN public."PERTENENCIA_CUADRILLA" m ON m."idCuadrilla"=a."idCuadrilla"
            WHERE a."idReporte"=%s AND m."idUsuario"=%s AND m."fechaInicio"<=now() AND (m."fechaFin" IS NULL OR m."fechaFin">now())''',(report_id,user['idUsuario'])).fetchone()
            require(found,'No tienes acceso a este reporte.',403)
        return row

    def detail(self,identifier,user):
        with connection() as conn:
            self.can_read(conn,identifier,user)
            row=conn.execute(REPORT_SELECT+' WHERE r."idReporte"=%s',(identifier,)).fetchone()
            row['fotoDisponible']=conn.execute('SELECT 1 FROM public."FOTO_REPORTE" WHERE "idReporte"=%s',(identifier,)).fetchone() is not None
            # Solo el personal municipal ve motivos internos de prioridad, asignación y duplicidad.
            history=conn.execute('''SELECT h.*,e."nombreEstado",concat(p.nombres,' ',p.apellidos) AS responsable FROM public."HISTORIAL_ESTADO_REPORTE" h
            JOIN public."ESTADO_REPORTE" e ON e."idEstadoReporte"=h."idEstadoReporte"
            JOIN public."USUARIO_SISTEMA" u ON u."idUsuario"=h."idUsuarioResponsable" JOIN public."Persona" p ON p."idPersona"=u."idPersona"
            WHERE h."idReporte"=%s ORDER BY h."fechaCambio",h."idHistorial"''',(identifier,)).fetchall()
            reviews=conn.execute('SELECT revision,motivo,"fechaCambio" FROM public."HISTORIAL_REVISION_REPORTE" WHERE "idReporte"=%s ORDER BY "idRevision"',(identifier,)).fetchall()
            result={'reporte':row,'estados':history,'revisiones':reviews,'atenciones':self._attentions(conn,identifier,user)}
            if user['rol']=='administrador':
                result['prioridades']=conn.execute('''SELECT h.*,p."nombrePrioridad" FROM public."HISTORIAL_PRIORIDAD" h JOIN public."PRIORIDAD" p ON p."idPrioridad"=h."idPrioridad" WHERE h."idReporte"=%s ORDER BY h."idHistorialPrioridad"''',(identifier,)).fetchall()
                result['asignaciones']=conn.execute('''SELECT h.*,c."nombreCuadrilla",v.placa FROM public."HISTORIAL_ASIGNACION" h
                JOIN public."ATENCION_LIMPIEZA" a ON a."idAtencion"=h."idAtencion" JOIN public."CUADRILLA" c ON c."idCuadrilla"=h."idCuadrilla"
                JOIN public."VEHICULO_RECOLECTOR" v ON v."idVehiculo"=h."idVehiculo" WHERE a."idReporte"=%s ORDER BY h."idHistorialAsignacion"''',(identifier,)).fetchall()
            return result

    def change_state(self,conn,report_id,name,user_id,note):
        state=conn.execute('SELECT "idEstadoReporte" FROM public."ESTADO_REPORTE" WHERE "nombreEstado"=%s AND activo',(name,)).fetchone()
        require(state,'El estado requerido no está disponible.')
        conn.execute('UPDATE public."REPORTE_INCIDENCIA" SET "idEstadoReporte"=%s WHERE "idReporte"=%s',(state['idEstadoReporte'],report_id))
        conn.execute('''INSERT INTO public."HISTORIAL_ESTADO_REPORTE" ("idReporte","idEstadoReporte","idUsuarioResponsable",observacion) VALUES (%s,%s,%s,%s)''',(report_id,state['idEstadoReporte'],user_id,note))

    def create_report(self,data,user):
        photo=prepare_photo(data.get('imagenBase64'))
        with connection() as conn:
            lock(conn)
            catalog=one(conn,'TIPO_RESIDUO','idTipoResiduo',data['idTipoResiduo'])
            require(catalog['activo'],'Elige un tipo de residuo activo.')
            state=conn.execute('SELECT "idEstadoReporte" FROM public."ESTADO_REPORTE" WHERE "nombreEstado"=\'pendiente\' AND activo').fetchone()
            require(state,'El estado pendiente no está disponible.')
            row=conn.execute('''INSERT INTO public."REPORTE_INCIDENCIA" ("idUsuarioReportante","idTipoResiduo","idEstadoReporte",descripcion,"direccionReferencia",latitud,longitud)
            VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *''',(user['idUsuario'],data['idTipoResiduo'],state['idEstadoReporte'],data['descripcion'],data['direccionReferencia'],data['latitud'],data['longitud'])).fetchone()
            self.change_state(conn,row['idReporte'],'pendiente',user['idUsuario'],'Reporte recibido. Pendiente de revisión municipal.')
            if photo:
                conn.execute('INSERT INTO public."FOTO_REPORTE" ("idReporte",contenido) VALUES (%s,%s)',(row['idReporte'],photo))
            return row

    def report_photo(self,identifier,user):
        with connection() as conn:
            self.can_read(conn,identifier,user)
            row=conn.execute('SELECT contenido,"tipoContenido" FROM public."FOTO_REPORTE" WHERE "idReporte"=%s',(identifier,)).fetchone()
            require(row,'Este reporte no tiene fotografía.',404)
            return row

    def review(self,identifier,data,user):
        with connection() as conn:
            lock(conn);one(conn,'REPORTE_INCIDENCIA','idReporte',identifier)
            count=conn.execute('SELECT 1 FROM public."ATENCION_LIMPIEZA" WHERE "idReporte"=%s LIMIT 1',(identifier,)).fetchone()
            require(not count,'No se puede cambiar la revisión de un reporte con atenciones registradas.')
            require(data['revision']!='aprobado' or data['validacionTerritorial']=='dentro','Solo se aprueban reportes dentro del ámbito municipal.')
            conn.execute('''UPDATE public."REPORTE_INCIDENCIA" SET revision=%s,"validacionTerritorial"=%s,"idUsuarioValidador"=%s,"fechaValidacion"=now(),"observacionValidacion"=%s WHERE "idReporte"=%s''',
            (data['revision'],data['validacionTerritorial'],user['idUsuario'],data['motivo'],identifier))
            conn.execute('''INSERT INTO public."HISTORIAL_REVISION_REPORTE" ("idReporte",revision,"idUsuarioResponsable",motivo) VALUES (%s,%s,%s,%s)''',(identifier,data['revision'],user['idUsuario'],data['motivo']))
            return {'message':'Decisión municipal guardada.'}

    def priority(self,identifier,data,user):
        with connection() as conn:
            lock(conn);one(conn,'REPORTE_INCIDENCIA','idReporte',identifier)
            p=one(conn,'PRIORIDAD','idPrioridad',data['idPrioridad']);require(p['activo'],'La prioridad está desactivada.')
            conn.execute('UPDATE public."REPORTE_INCIDENCIA" SET "idPrioridad"=%s WHERE "idReporte"=%s',(data['idPrioridad'],identifier))
            conn.execute('INSERT INTO public."HISTORIAL_PRIORIDAD" ("idReporte","idPrioridad","idUsuarioResponsable",motivo) VALUES (%s,%s,%s,%s)',(identifier,data['idPrioridad'],user['idUsuario'],data['motivo']))
            return {'message':'Prioridad registrada con su historial.'}

    def duplicate(self,identifier,data,user):
        with connection() as conn:
            lock(conn);r=one(conn,'REPORTE_INCIDENCIA','idReporte',identifier)
            current=data['idReporteOriginal'];seen={identifier}
            while current is not None:
                require(current not in seen,'No se permiten duplicados de sí mismos ni relaciones circulares.')
                seen.add(current);current=one(conn,'REPORTE_INCIDENCIA','idReporte',current)['idReporteOriginal']
            conn.execute('UPDATE public."REPORTE_INCIDENCIA" SET "idReporteOriginal"=%s WHERE "idReporte"=%s',(data['idReporteOriginal'],identifier))
            state=conn.execute('SELECT "nombreEstado" FROM public."ESTADO_REPORTE" WHERE "idEstadoReporte"=%s',(r['idEstadoReporte'],)).fetchone()
            self.change_state(conn,identifier,state['nombreEstado'],user['idUsuario'],'Revisión de duplicidad: '+data['motivo'])
            return {'message':'Relación de duplicidad guardada sin eliminar reportes.'}

    def resources(self):
        with connection() as conn:
            crews=conn.execute('''SELECT c.*, NOT EXISTS(SELECT 1 FROM public."ATENCION_LIMPIEZA" a WHERE a."idCuadrilla"=c."idCuadrilla" AND a."fechaFin" IS NULL) AND c."fechaBaja" IS NULL AS disponible FROM public."CUADRILLA" c ORDER BY c."idCuadrilla"''').fetchall()
            vehicles=conn.execute('''SELECT v.*,NOT EXISTS(SELECT 1 FROM public."ATENCION_LIMPIEZA" a WHERE a."idVehiculo"=v."idVehiculo" AND a."fechaFin" IS NULL) AND v."fechaBaja" IS NULL AND v."estadoOperativo"='operativo' AS disponible FROM public."VEHICULO_RECOLECTOR" v ORDER BY v."idVehiculo"''').fetchall()
            members=conn.execute('''SELECT m.*,concat(p.nombres,' ',p.apellidos) AS integrante FROM public."PERTENENCIA_CUADRILLA" m JOIN public."USUARIO_SISTEMA" u ON u."idUsuario"=m."idUsuario" JOIN public."Persona" p ON p."idPersona"=u."idPersona" ORDER BY m."idPertenencia"''').fetchall()
            return {'cuadrillas':crews,'vehiculos':vehicles,'integrantes':members}

    def save_resource(self,kind,data,identifier=None):
        table,key=('CUADRILLA','idCuadrilla') if kind=='cuadrillas' else ('VEHICULO_RECOLECTOR','idVehiculo')
        with connection() as conn:
            lock(conn)
            if identifier:
                one(conn,table,key,identifier)
                if not data['activo'] or data.get('estadoOperativo','operativo')!='operativo':
                    active=conn.execute(sql.SQL('SELECT 1 FROM public."ATENCION_LIMPIEZA" WHERE {}=%s AND "fechaFin" IS NULL').format(sql.Identifier(key)),(identifier,)).fetchone()
                    require(not active,'Reasigna o finaliza la atención antes de dar de baja o retirar el recurso.')
            fields={k:v for k,v in data.items() if k!='activo'}
            if 'placa' in fields:fields['placa']=fields['placa'].upper()
            if identifier:
                sets=[sql.SQL('{}=%s').format(sql.Identifier(k)) for k in fields]
                sets.append(sql.SQL('"fechaBaja"=CASE WHEN %s THEN NULL ELSE COALESCE("fechaBaja",now()) END'))
                return conn.execute(sql.SQL('UPDATE public.{} SET {} WHERE {}=%s RETURNING *').format(sql.Identifier(table),sql.SQL(',').join(sets),sql.Identifier(key)),(*fields.values(),data['activo'],identifier)).fetchone()
            require(data['activo'],'Un recurso nuevo debe estar activo.')
            return conn.execute(sql.SQL('INSERT INTO public.{} ({}) VALUES ({}) RETURNING *').format(sql.Identifier(table),sql.SQL(',').join(map(sql.Identifier,fields)),sql.SQL(',').join(sql.Placeholder() for _ in fields)),tuple(fields.values())).fetchone()

    def membership(self,crew_id,user_id):
        with connection() as conn:
            lock(conn);c=one(conn,'CUADRILLA','idCuadrilla',crew_id);require(c['fechaBaja'] is None,'La cuadrilla está de baja.')
            u=conn.execute('''SELECT u.* FROM public."USUARIO_SISTEMA" u JOIN public."ROL" r ON r."idRol"=u."idRol" WHERE u."idUsuario"=%s AND u."fechaEliminacion" IS NULL AND r."nombreRol"='cuadrilla' ''',(user_id,)).fetchone()
            require(u,'Selecciona una cuenta activa con rol cuadrilla.')
            return conn.execute('INSERT INTO public."PERTENENCIA_CUADRILLA" ("idUsuario","idCuadrilla") VALUES (%s,%s) RETURNING *',(user_id,crew_id)).fetchone()

    def end_membership(self,identifier):
        with connection() as conn:
            lock(conn);one(conn,'PERTENENCIA_CUADRILLA','idPertenencia',identifier)
            conn.execute('UPDATE public."PERTENENCIA_CUADRILLA" SET "fechaFin"=COALESCE("fechaFin",now()) WHERE "idPertenencia"=%s',(identifier,))
            return {'message':'Pertenencia finalizada.'}

    def _check_resources(self,conn,data,except_id=None):
        c=one(conn,'CUADRILLA','idCuadrilla',data['idCuadrilla']);v=one(conn,'VEHICULO_RECOLECTOR','idVehiculo',data['idVehiculo'])
        require(c['fechaBaja'] is None,'La cuadrilla está de baja.')
        require(v['fechaBaja'] is None and v['estadoOperativo']=='operativo','El vehículo no está operativo.')
        busy=conn.execute('''SELECT 1 FROM public."ATENCION_LIMPIEZA" WHERE "fechaFin" IS NULL AND ("idCuadrilla"=%s OR "idVehiculo"=%s) AND (%s::bigint IS NULL OR "idAtencion"<>%s)''',(data['idCuadrilla'],data['idVehiculo'],except_id,except_id)).fetchone()
        require(not busy,'La cuadrilla o el vehículo ya tiene una atención abierta. Elige recursos disponibles.')

    def assign(self,report_id,data,user,attention_id=None):
        with connection() as conn:
            lock(conn);r=one(conn,'REPORTE_INCIDENCIA','idReporte',report_id)
            require(r['revision']=='aprobado' and r['validacionTerritorial']=='dentro' and r['idPrioridad'],'Primero aprueba el reporte, valida su ámbito y establece una prioridad.')
            state=conn.execute('SELECT "nombreEstado" FROM public."ESTADO_REPORTE" WHERE "idEstadoReporte"=%s',(r['idEstadoReporte'],)).fetchone()
            require(state['nombreEstado']!='resuelto','Reabre el reporte antes de asignar otra atención.')
            self._check_resources(conn,data,attention_id)
            if attention_id:
                a=one(conn,'ATENCION_LIMPIEZA','idAtencion',attention_id)
                require(a['idReporte']==report_id and a['fechaInicio'] is None and a['fechaFin'] is None,'Solo se reasignan atenciones que todavía no han comenzado.')
                conn.execute('UPDATE public."HISTORIAL_ASIGNACION" SET "fechaFin"=now() WHERE "idAtencion"=%s AND "fechaFin" IS NULL',(attention_id,))
                conn.execute('''UPDATE public."ATENCION_LIMPIEZA" SET "idCuadrilla"=%s,"idVehiculo"=%s,"idUsuarioAsignador"=%s,"fechaAsignacion"=now() WHERE "idAtencion"=%s''',(data['idCuadrilla'],data['idVehiculo'],user['idUsuario'],attention_id))
            else:
                a=conn.execute('''INSERT INTO public."ATENCION_LIMPIEZA" ("idReporte","idCuadrilla","idVehiculo","idUsuarioAsignador") VALUES (%s,%s,%s,%s) RETURNING *''',(report_id,data['idCuadrilla'],data['idVehiculo'],user['idUsuario'])).fetchone();attention_id=a['idAtencion']
            conn.execute('''INSERT INTO public."HISTORIAL_ASIGNACION" ("idAtencion","idCuadrilla","idVehiculo","idUsuarioAsignador",motivo) VALUES (%s,%s,%s,%s,%s)''',(attention_id,data['idCuadrilla'],data['idVehiculo'],user['idUsuario'],data['motivo']))
            return {'message':'Asignación guardada.','idAtencion':attention_id}

    def _attentions(self,conn,report_id=None,user=None):
        clause='';params=()
        if report_id:clause='WHERE a."idReporte"=%s';params=(report_id,)
        if user and user['rol']=='cuadrilla':
            clause+=(' AND ' if clause else 'WHERE ')+'''EXISTS (SELECT 1 FROM public."PERTENENCIA_CUADRILLA" m WHERE m."idCuadrilla"=a."idCuadrilla" AND m."idUsuario"=%s AND m."fechaInicio"<=now() AND (m."fechaFin" IS NULL OR m."fechaFin">now()))''';params+= (user['idUsuario'],)
        return conn.execute('''SELECT a.*,c."nombreCuadrilla",v.placa,r.descripcion,r."direccionReferencia",r.latitud,r.longitud,p."nombrePrioridad" FROM public."ATENCION_LIMPIEZA" a
        JOIN public."CUADRILLA" c ON c."idCuadrilla"=a."idCuadrilla" JOIN public."VEHICULO_RECOLECTOR" v ON v."idVehiculo"=a."idVehiculo"
        JOIN public."REPORTE_INCIDENCIA" r ON r."idReporte"=a."idReporte" LEFT JOIN public."PRIORIDAD" p ON p."idPrioridad"=r."idPrioridad" '''+clause+' ORDER BY a."idAtencion" DESC',params).fetchall()

    def attentions(self,user):
        with connection() as conn:return self._attentions(conn,user=user)

    def attention_action(self,identifier,action,note,user):
        with connection() as conn:
            lock(conn);a=one(conn,'ATENCION_LIMPIEZA','idAtencion',identifier)
            if user['rol']=='cuadrilla':
                member=conn.execute('''SELECT 1 FROM public."PERTENENCIA_CUADRILLA" WHERE "idCuadrilla"=%s AND "idUsuario"=%s AND "fechaInicio"<=now() AND ("fechaFin" IS NULL OR "fechaFin">now())''',(a['idCuadrilla'],user['idUsuario'])).fetchone()
                require(member,'No puedes modificar tareas fuera de tu pertenencia vigente.',403)
            require(a['fechaFin'] is None,'La atención ya finalizó.')
            if action=='iniciar':
                require(a['fechaInicio'] is None,'La atención ya comenzó.')
                conn.execute('UPDATE public."ATENCION_LIMPIEZA" SET "fechaInicio"=now() WHERE "idAtencion"=%s',(identifier,))
                self.change_state(conn,a['idReporte'],'en proceso',user['idUsuario'],'La cuadrilla inició la atención.')
            elif action=='finalizar':
                require(a['fechaInicio'] is not None,'Primero registra el inicio de la atención.')
                conn.execute('UPDATE public."ATENCION_LIMPIEZA" SET "fechaFin"=now(),"observacionCuadrilla"=%s WHERE "idAtencion"=%s',(note,identifier))
                conn.execute('UPDATE public."HISTORIAL_ASIGNACION" SET "fechaFin"=now() WHERE "idAtencion"=%s AND "fechaFin" IS NULL',(identifier,))
                self.change_state(conn,a['idReporte'],'en proceso',user['idUsuario'],'Intervención finalizada. Pendiente de validación municipal: '+note)
            else:
                conn.execute('UPDATE public."ATENCION_LIMPIEZA" SET "observacionCuadrilla"=concat_ws(E\'\\n\',NULLIF("observacionCuadrilla",\'\'),%s::text) WHERE "idAtencion"=%s',(note,identifier))
                state=conn.execute('SELECT e."nombreEstado" FROM public."REPORTE_INCIDENCIA" r JOIN public."ESTADO_REPORTE" e ON e."idEstadoReporte"=r."idEstadoReporte" WHERE r."idReporte"=%s',(a['idReporte'],)).fetchone()
                self.change_state(conn,a['idReporte'],state['nombreEstado'],user['idUsuario'],'Observación de cuadrilla: '+note)
            return {'message':'Avance registrado con su historial.'}

    def close(self,identifier,note,user,reopen=False):
        with connection() as conn:
            lock(conn);r=one(conn,'REPORTE_INCIDENCIA','idReporte',identifier)
            require(r['revision']=='aprobado','Solo se atienden reportes aprobados.')
            state=conn.execute('SELECT "nombreEstado" FROM public."ESTADO_REPORTE" WHERE "idEstadoReporte"=%s',(r['idEstadoReporte'],)).fetchone()
            if reopen:require(state['nombreEstado']=='resuelto','Solo se reabren reportes resueltos.')
            else:
                require(state['nombreEstado']!='resuelto','El reporte ya está resuelto.')
                rows=conn.execute('SELECT "fechaFin" FROM public."ATENCION_LIMPIEZA" WHERE "idReporte"=%s',(identifier,)).fetchall()
                require(rows and all(a['fechaFin'] for a in rows),'Debes finalizar todas las atenciones antes de resolver el reporte.')
            self.change_state(conn,identifier,'pendiente' if reopen else 'resuelto',user['idUsuario'],('Reapertura: ' if reopen else 'Resolución validada: ')+note)
            return {'message':'Reporte reabierto.' if reopen else 'Resolución confirmada.'}

    def accounts(self):
        with connection() as conn:
            return conn.execute('''SELECT u."idUsuario",u.correo,u."idPersona",r."nombreRol" AS rol,u."fechaEliminacion",concat(p.nombres,' ',p.apellidos) AS nombre FROM public."USUARIO_SISTEMA" u JOIN public."ROL" r ON r."idRol"=u."idRol" JOIN public."Persona" p ON p."idPersona"=u."idPersona" ORDER BY u."idUsuario"''').fetchall()

    def save_account(self,identifier,data,user):
        with connection() as conn:
            lock(conn);one(conn,'USUARIO_SISTEMA','idUsuario',identifier)
            require(identifier!=user['idUsuario'],'No puedes cambiar tu propio rol ni desactivar tu sesión administrativa.')
            active=conn.execute('''SELECT 1 FROM public."PERTENENCIA_CUADRILLA" WHERE "idUsuario"=%s AND "fechaFin" IS NULL''',(identifier,)).fetchone()
            require(not active or (data['activo'] and data['rol']=='cuadrilla'),'Finaliza su pertenencia a las cuadrillas antes de cambiar el rol o desactivar la cuenta.')
            role=conn.execute('SELECT "idRol" FROM public."ROL" WHERE "nombreRol"=%s AND activo',(data['rol'],)).fetchone();require(role,'Rol no disponible.')
            conn.execute('''UPDATE public."USUARIO_SISTEMA" SET "idRol"=%s,"fechaEliminacion"=CASE WHEN %s THEN NULL ELSE now() END WHERE "idUsuario"=%s''',(role['idRol'],data['activo'],identifier))
            conn.execute('DELETE FROM public."SESION" WHERE "idUsuario"=%s',(identifier,))
            return {'message':'Cuenta actualizada y sesiones anteriores revocadas.'}

    def indicators(self,date_from=None,date_to=None):
        with connection() as conn:
            params=(date_from,date_from,date_to,date_to)
            counts=conn.execute('''SELECT count(*) AS total,count(*) FILTER(WHERE r.revision='pendiente') AS revision_pendiente,
            count(*) FILTER(WHERE r.revision='aprobado') AS aprobados,count(*) FILTER(WHERE r.revision='rechazado') AS rechazados,
            count(*) FILTER(WHERE r.revision='aprobado' AND e."nombreEstado"='pendiente') AS pendientes,
            count(*) FILTER(WHERE r.revision='aprobado' AND e."nombreEstado"='en proceso') AS en_proceso,
            count(*) FILTER(WHERE r.revision='aprobado' AND e."nombreEstado"='resuelto') AS resueltos
            FROM public."REPORTE_INCIDENCIA" r JOIN public."ESTADO_REPORTE" e ON e."idEstadoReporte"=r."idEstadoReporte"
            WHERE (%s::date IS NULL OR r."fechaReporte">=%s::date) AND (%s::date IS NULL OR r."fechaReporte"<%s::date+interval '1 day')''',params).fetchone()
            load=conn.execute('''SELECT c."nombreCuadrilla",count(a."idAtencion") AS total,count(a."idAtencion") FILTER(WHERE a."fechaFin" IS NULL) AS abiertas
            FROM public."CUADRILLA" c LEFT JOIN (public."ATENCION_LIMPIEZA" a JOIN public."REPORTE_INCIDENCIA" r ON r."idReporte"=a."idReporte"
            AND (%s::date IS NULL OR r."fechaReporte">=%s::date) AND (%s::date IS NULL OR r."fechaReporte"<%s::date+interval '1 day')) ON a."idCuadrilla"=c."idCuadrilla" GROUP BY c."idCuadrilla" ORDER BY total DESC''',params).fetchall()
            times=conn.execute('''WITH tiempos AS (SELECT r."idReporte",r."fechaReporte",e."nombreEstado",
            (SELECT min(a."fechaInicio") FROM public."ATENCION_LIMPIEZA" a WHERE a."idReporte"=r."idReporte") AS inicio,
            (SELECT max(h."fechaCambio") FROM public."HISTORIAL_ESTADO_REPORTE" h JOIN public."ESTADO_REPORTE" s ON s."idEstadoReporte"=h."idEstadoReporte" WHERE h."idReporte"=r."idReporte" AND s."nombreEstado"='resuelto') AS cierre
            FROM public."REPORTE_INCIDENCIA" r JOIN public."ESTADO_REPORTE" e ON e."idEstadoReporte"=r."idEstadoReporte" WHERE r.revision='aprobado'
            AND (%s::date IS NULL OR r."fechaReporte">=%s::date) AND (%s::date IS NULL OR r."fechaReporte"<%s::date+interval '1 day'))
            SELECT avg(extract(epoch FROM inicio-"fechaReporte")/3600) AS horas_inicio,
            avg(extract(epoch FROM cierre-"fechaReporte")/3600) FILTER(WHERE "nombreEstado"='resuelto') AS horas_resolucion FROM tiempos''',params).fetchone()
            return {**counts,**times,'cuadrillas':load,'actualizado':conn.execute('SELECT now() AS fecha').fetchone()['fecha'],'desde':date_from,'hasta':date_to}
