// Key Vault holding the two runtime secrets the app needs: the PostgreSQL
// connection string and the session-signing secret. RBAC authorization is
// used (no legacy access policies), soft delete is always on for vaults
// created with this API version, and purge protection is enabled so a
// secret/vault cannot be permanently destroyed inside the retention window
// even by someone with delete permission.
targetScope = 'resourceGroup'

@description('Azure region for all resources.')
param location string

@description('Tags applied to every resource in this module.')
param tags object

@description('Globally-unique Key Vault name (3-24 characters), computed by the caller from a non-secret uniqueString() seed.')
@minLength(3)
@maxLength(24)
param keyVaultName string

@description('Azure AD tenant ID that owns this vault. Comes from the caller\'s current `az account` context, never hard-coded in source.')
param tenantId string = subscription().tenantId

@secure()
@description('Full PostgreSQL connection string (postgres://user:password@host:5432/db?sslmode=require) stored as the DATABASE_URL secret.')
param databaseUrl string

@secure()
@description('Session-signing secret (>=32 chars) stored as the SESSION_SIGNING_SECRET secret.')
param sessionSigningSecret string

resource keyVault 'Microsoft.KeyVault/vaults@2024-11-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

resource databaseUrlSecret 'Microsoft.KeyVault/vaults/secrets@2024-11-01' = {
  parent: keyVault
  name: 'DATABASE-URL'
  properties: {
    value: databaseUrl
    contentType: 'text/plain'
  }
}

resource sessionSigningSecretSecret 'Microsoft.KeyVault/vaults/secrets@2024-11-01' = {
  parent: keyVault
  name: 'SESSION-SIGNING-SECRET'
  properties: {
    value: sessionSigningSecret
    contentType: 'text/plain'
  }
}

output keyVaultName string = keyVault.name
output keyVaultId string = keyVault.id
output keyVaultUri string = keyVault.properties.vaultUri
output databaseUrlSecretUri string = databaseUrlSecret.properties.secretUri
output sessionSigningSecretUri string = sessionSigningSecretSecret.properties.secretUri
