
path "database/creds/my-role" {
  capabilities = ["read", "update"] # 'update' for read/rekey sometimes, or 'read' is enough for basic fetch
}
path "sys/leases/renew" {
  capabilities = ["update"] # Required for renewing any lease_id
}
path "sys/leases/lookup" {
  capabilities = ["update"] # Required for looking up lease details, useful for checking remaining TTL
}
path "sys/leases/revoke" {
  capabilities = ["update"] # Might be needed if your app ever revokes
}
path "auth/token/renew-self" {
  capabilities = ["update"]
}
path "auth/token/lookup-self" {
  capabilities = ["read"]
}