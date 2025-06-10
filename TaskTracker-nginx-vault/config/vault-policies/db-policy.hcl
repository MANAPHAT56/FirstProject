path "database/creds/my-role" {
  capabilities = ["read"]
}

path "database/roles/*" {
  capabilities = ["list"]
}