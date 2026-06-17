-- Produção: stancl/tenancy precisa criar bancos nagibi_tenant_*.
-- MYSQL_USER (padrão: nagibi) já foi criado pelo entrypoint do MySQL.
GRANT CREATE, DROP, ALTER, INDEX, REFERENCES ON *.* TO 'nagibi'@'%';
FLUSH PRIVILEGES;
