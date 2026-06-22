-- Necessário para o stancl/tenancy criar automaticamente
-- os bancos nagibi_tenant_* ao cadastrar um novo tenant.
GRANT CREATE,
    DROP,
    ALTER,
    INDEX,
    REFERENCES ON *.* TO 'nagibi' @'%';
GRANT ALL PRIVILEGES ON `nagibi_central`.* TO 'nagibi' @'%';
GRANT ALL PRIVILEGES ON `nagibi\_tenant\_%`.* TO 'nagibi' @'%';
GRANT CREATE,
    DROP,
    ALTER,
    INDEX,
    REFERENCES ON *.* TO 'nagibi' @'%';
FLUSH PRIVILEGES;
FLUSH PRIVILEGES;