-- Necessário para o stancl/tenancy criar automaticamente
-- os bancos nagibi_tenant_* ao cadastrar um novo tenant.
GRANT CREATE, DROP, ALTER, INDEX, REFERENCES ON *.* TO 'dev'@'%';
GRANT CREATE, DROP, ALTER, INDEX, REFERENCES ON *.* TO 'nagibi'@'%';
FLUSH PRIVILEGES;
