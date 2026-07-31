// Storage account for uploaded source documents and generated PDF packages.
//
// Security posture: HTTPS-only, TLS 1.2 minimum, shared-key (account key)
// access disabled so every data-plane call must use Azure AD (managed
// identity for the web app, `az storage ... --auth-mode login` for
// operators), and anonymous/public blob access disabled at the account
// level. Both containers are created with `publicAccess: 'None'`.
//
// Network access is left public (with HTTPS+AAD auth required for every
// call) rather than behind a private endpoint: the task's private-networking
// requirement is scoped to PostgreSQL, and adding Storage private endpoints
// would also require routing App Service's regional VNet integration through
// matching private DNS zones for blob — maintainable, but out of scope for
// this MVP. This is a deliberate, documented tradeoff (see README), not a
// silent gap: identity and transport are both enforced regardless.
targetScope = 'resourceGroup'

@description('Azure region for all resources.')
param location string

@description('Tags applied to every resource in this module.')
param tags object

@description('Globally-unique storage account name (3-24 lowercase alphanumeric characters), computed by the caller from a non-secret uniqueString() seed.')
@minLength(3)
@maxLength(24)
param storageAccountName string

@description('Container name for uploaded source documents (7-day lifecycle deletion).')
param sourceDocumentsContainerName string = 'case-documents'

@description('Container name for generated attorney-review PDF packages (retained indefinitely; never auto-deleted).')
param generatedPackagesContainerName string = 'generated-packages'

@description('Days after upload before source documents are deleted by the lifecycle policy. Generated packages are never covered by this rule.')
param sourceDocumentRetentionDays int = 7


resource storageAccount 'Microsoft.Storage/storageAccounts@2024-01-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowSharedKeyAccess: false
    allowBlobPublicAccess: false
    allowCrossTenantReplication: false
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
    accessTier: 'Hot'
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2024-01-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    deleteRetentionPolicy: {
      enabled: true
      days: 14
    }
    containerDeleteRetentionPolicy: {
      enabled: true
      days: 14
    }
  }
}

resource sourceDocumentsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2024-01-01' = {
  parent: blobService
  name: sourceDocumentsContainerName
  properties: {
    publicAccess: 'None'
  }
}

resource generatedPackagesContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2024-01-01' = {
  parent: blobService
  name: generatedPackagesContainerName
  properties: {
    publicAccess: 'None'
  }
}

// Lifecycle management: source documents are deleted after N days. Scoped by
// blob prefix match to the source-documents container only, so generated
// packages in the other container are never touched by this rule.
resource lifecyclePolicy 'Microsoft.Storage/storageAccounts/managementPolicies@2024-01-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    policy: {
      rules: [
        {
          name: 'delete-source-documents-after-retention'
          enabled: true
          type: 'Lifecycle'
          definition: {
            filters: {
              blobTypes: [
                'blockBlob'
              ]
              prefixMatch: [
                '${sourceDocumentsContainerName}/'
              ]
            }
            actions: {
              baseBlob: {
                delete: {
                  daysAfterCreationGreaterThan: sourceDocumentRetentionDays
                }
              }
            }
          }
        }
      ]
    }
  }
  dependsOn: [
    sourceDocumentsContainer
    generatedPackagesContainer
  ]
}

output storageAccountName string = storageAccount.name
output storageAccountId string = storageAccount.id
output sourceDocumentsContainerName string = sourceDocumentsContainer.name
output generatedPackagesContainerName string = generatedPackagesContainer.name
