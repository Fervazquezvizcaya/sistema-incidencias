```mermaid
erDiagram
    Role {
        int id_rol PK
        string nombre_rol
    }
    
    User {
        string id_usuario PK
        string nombre_completo
        string correo
        string password
        boolean activo
        int id_rol FK
    }
    
    Reporte {
        string folio_incidencia PK
        string ubicacion
        string edificio
        string aula
        string descripcion
        string estado
        datetime fecha_creacion
        string dictamen_cierre
        string id_creador FK
        string id_tecnico FK
    }

    Role ||--o{ User : "asigna_a"
    User ||--o{ Reporte : "levanta"
    User ||--o{ Reporte : "atiende"