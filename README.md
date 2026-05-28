# EduInspect: Sistema de Gestión Administrativa de Mantenimiento Institucional

> **Nota sobre el control de versiones:**
> El historial de commits de la etapa de desarrollo inicial no se encuentra disponible debido a una corrupción inesperada en el directorio `.git` del entorno local (fatal error). Para garantizar la integridad del código, se inicializó un nuevo repositorio y se realizó la subida de la versión estable y funcional en un único commit principal.

---

## 📌 Descripción del Proyecto

**EduInspect** es una plataforma web desarrollada para la digitalización, gestión y seguimiento de incidencias en la infraestructura física institucional de la FES Aragón. El sistema elimina la dependencia de bitácoras manuales, permitiendo un flujo de comunicación directo entre la comunidad universitaria y el área de mantenimiento a través de un entorno seguro y en tiempo real.

## 🏗️ Arquitectura y Microservicios

El sistema está diseñado bajo una arquitectura orientada a microservicios y desplegado mediante contenedores para garantizar alta disponibilidad y escalabilidad. Se compone de los siguientes módulos:

* **`ms-auth` (Microservicio de Autenticación):** Gestiona el inicio de sesión, validación de credenciales y protección de rutas.
* **`ms-registro` (Microservicio de Registro):** Interfaz orientada al usuario final para la captura y levantamiento de nuevos reportes de fallas.
* **`ms-seguimiento` (Microservicio de Seguimiento):** Panel operativo y directivo (Dashboard) para actualizar estados (Pendiente, En Proceso, Atendido), generar métricas y capturar bitácoras de cierre.
* **`db` (Base de Datos):** Contenedor aislado de MySQL que centraliza la información y garantiza la integridad referencial de los datos.

## 💻 Stack Tecnológico

* **Frontend:** React.js / Next.js (App Router)
* **Backend:** Node.js (Next.js Server Actions)
* **Base de Datos:** MySQL Server
* **Infraestructura:** Docker / Docker Compose
* **Estilos:** CSS Modules / UI Responsive (Dark Mode adaptativo)

## 👥 Roles de Usuario

El sistema opera bajo un modelo de control de acceso basado en roles (RBAC):
1.  **Administrador:** Acceso global a métricas, listados totales y gestión de personal (altas y bajas lógicas).
2.  **Mantenimiento (Técnico):** Capacidad para visualizar folios pendientes, tomar asignaciones y redactar el dictamen final de reparación.
3.  **Usuario (Comunidad):** Permisos básicos para levantar reportes de incidencias y monitorear el estado de los folios de su autoría.

## 🚀 Despliegue Local

### Requisitos Previos
* [Docker](https://www.docker.com/products/docker-desktop) instalado y ejecutándose en la máquina anfitriona.
* [Docker Compose](https://docs.docker.com/compose/install/).
