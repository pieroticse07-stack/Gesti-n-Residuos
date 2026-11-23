import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../shared/icon';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, Icon],
  template: `
    <section class="landing-hero">
      <div class="hero-copy">
        <span class="section-tag"><app-icon name="leaf" /> PARTICIPACIÓN CIUDADANA</span>
        <h1>Una ciudad más limpia<br />empieza <em>contigo.</em></h1>
        <p>
          Ayúdanos a identificar los puntos de acumulación de residuos en Huancayo. Reporta, conoce
          el avance y sé parte del cambio.
        </p>
        <div class="hero-actions">
          <a class="button primary large" routerLink="/registro"
            ><app-icon name="plus" />Quiero reportar</a
          ><a class="button subtle large" routerLink="/ingresar">Ya tengo una cuenta</a>
        </div>
        <div class="hero-location">
          <app-icon name="pin" /> Huancayo, Junín · Cuidamos nuestros espacios
        </div>
      </div>
      <div class="hero-visual">
        <div class="city-art">
          <img
            class="recycling-photo"
            src="/images/reciclaje-huancayo.png"
            alt="Niños participando en una actividad de reciclaje con materiales recolectados"
            width="656"
            height="395"
            fetchpriority="high"
          />
          <div class="floating-card">
            <span class="mini-icon"><app-icon name="check" /></span>
            <div>
              <strong>Cada reporte cuenta</strong><span>Conectamos tu voz con la acción</span>
            </div>
          </div>
        </div>
      </div>
    </section>
    <section class="landing-process">
      <div class="section-heading">
        <span class="eyebrow">ASÍ PARTICIPAS</span>
        <h2>De tu reporte a una solución.</h2>
        <p>Un proceso claro, con seguimiento en cada etapa.</p>
      </div>
      <div class="process-grid">
        <article>
          <span class="process-icon"><app-icon name="pin" /></span>
          <h3>Cuéntanos dónde</h3>
          <p>Describe el incidente y confirma su ubicación para facilitar la revisión.</p>
        </article>
        <article>
          <span class="process-icon"><app-icon name="shield" /></span>
          <h3>Revisión municipal</h3>
          <p>El administrador evalúa el reporte, determina su prioridad y coordina la atención.</p>
        </article>
        <article>
          <span class="process-icon"><app-icon name="check" /></span>
          <h3>Sigue el avance</h3>
          <p>Consulta la decisión y los cambios de estado hasta la resolución validada.</p>
        </article>
      </div>
    </section>
    <section class="landing-bottom">
      <div>
        <span class="eyebrow">UNA RESPONSABILIDAD COMPARTIDA</span>
        <h2>Tu barrio también es tu hogar.</h2>
        <p>Una herramienta para conectar a ciudadanos y personal municipal.</p>
      </div>
      <a class="button primary" routerLink="/registro">Crear mi cuenta</a>
    </section>
  `,
  styleUrl: './landing.css',
})
export class Landing {}
