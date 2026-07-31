// Data-plane role assignments for the web app's system-assigned managed
// identity.
//
// These live in their own module for a specific reason. A role assignment's
// *name* is its identity to ARM, and ARM requires that name to be computable
// before the deployment starts — which rules out referencing a principal ID
// that only exists once the web app has been created. Naming the assignments
// after the web app instead meant that redeploying in a way that recreated
// the app (and so issued a new system-assigned principal) left the old
// assignment in place: same name, so ARM treated it as unchanged, still
// pointing at a principal that no longer existed. The deployment reported
// success while every Key Vault reference failed with
// AccessToKeyVaultDenied and the app booted with unresolved settings.
//
// Module parameters, unlike resource properties in the parent, are resolved
// before this module's own deployment begins. Passing the principal ID in as
// a parameter therefore lets the assignment names include it, so a new
// identity always produces new assignments.
targetScope = 'resourceGroup'

@description('Object ID of the web app system-assigned managed identity.')
param principalId string

@description('Name of the Key Vault holding the runtime secrets.')
param keyVaultName string

@description('Name of the storage account holding uploads and generated packages.')
param storageAccountName string

var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'
var storageBlobDataContributorRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'

resource keyVault 'Microsoft.KeyVault/vaults@2024-11-01' existing = {
  name: keyVaultName
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

resource keyVaultSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, principalId, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
  }
}

resource storageBlobDataContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, principalId, storageBlobDataContributorRoleId)
  scope: storageAccount
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRoleId)
  }
}
