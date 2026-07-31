// Azure AI Foundry (AI Services) account and the GPT deployment the
// assistant uses to rephrase retrieved Florida statutory passages.
//
// The model is emphatically NOT a source of legal content. Retrieval happens
// in application code against a corpus committed to this repository, and the
// model only receives passages that retrieval already selected. Its output is
// then re-checked for dollar figures and discarded if any appear. If this
// resource is unreachable, misconfigured, or removed, the assistant falls
// back to the deterministic local adapter — so this module is an enhancement
// to phrasing, never a dependency for correctness.
//
// Access is via the web app's managed identity (Cognitive Services OpenAI
// User). No API key is deployed: keys would need storing and rotating, and
// the identity already exists for Key Vault and Blob.
targetScope = 'resourceGroup'

@description('Azure region for the Foundry account.')
param location string

@description('Globally unique name for the AI Services account.')
param accountName string

@description('Name given to the model deployment; becomes AZURE_FOUNDRY_DEPLOYMENT.')
param deploymentName string

@description('Model to deploy.')
param modelName string

@description('Model version.')
param modelVersion string

@description('Tokens-per-minute capacity, in thousands.')
param capacity int

@description('Subnet used for the private endpoint.')
param privateLinkSubnetId string

@description('Object ID of the web app managed identity that will call the model.')
param principalId string

@description('Virtual network the private DNS zone is linked to.')
param virtualNetworkId string

param tags object = {}

// Tenant policy forces publicNetworkAccess to Disabled on several resource
// types minutes after creation and reverts any attempt to re-enable it, so a
// private endpoint is the only reliable route from App Service. Declaring it
// disabled up front makes the template honest about the end state rather
// than describing a configuration that silently will not hold.
resource account 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: accountName
  location: location
  tags: tags
  kind: 'AIServices'
  sku: {
    name: 'S0'
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    customSubDomainName: accountName
    publicNetworkAccess: 'Disabled'
    networkAcls: {
      defaultAction: 'Deny'
      virtualNetworkRules: []
      ipRules: []
    }
    // Entra-only: local API keys are disabled so the managed identity is the
    // sole way in and there is no key to leak or rotate.
    disableLocalAuth: true
  }
}

// Known ordering hazard: on a *first* deployment ARM sometimes starts this
// child resource while the parent account is still in `Accepted`, and the
// deployment fails with AccountProvisioningStateInvalid. The `parent`
// relationship below is the strongest ordering Bicep can express, so there is
// no template-level fix — re-run the deployment once the account reports
// `Succeeded` and it completes. Subsequent deployments are unaffected.
resource modelDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: account
  name: deploymentName
  sku: {
    name: 'GlobalStandard'
    capacity: capacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: modelName
      version: modelVersion
    }
    versionUpgradeOption: 'NoAutoUpgrade'
  }
}

// Local auth is disabled above, so this assignment is the only way in. It
// lives in this module (rather than the shared role-assignments one) because
// the assignment name must embed the principal ID to survive the web app
// being recreated, and module parameters are the only values ARM resolves
// early enough to appear in a resource name.
var openAiUserRoleId = '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'

resource openAiUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(account.id, principalId, openAiUserRoleId)
  scope: account
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', openAiUserRoleId)
  }
}

resource privateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {  name: 'privatelink.services.ai.azure.com'
  location: 'global'
  tags: tags
}

resource privateDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: privateDnsZone
  name: 'link-to-vnet'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: virtualNetworkId
    }
  }
}

// The data plane is also addressed as *.openai.azure.com and
// *.cognitiveservices.azure.com depending on the route the SDK picks, so all
// three zones are linked. Resolving only one of them produces an
// intermittent failure that looks like a transient network fault.
resource openAiDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.openai.azure.com'
  location: 'global'
  tags: tags
}

resource openAiDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: openAiDnsZone
  name: 'link-to-vnet'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: virtualNetworkId
    }
  }
}

resource cognitiveDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.cognitiveservices.azure.com'
  location: 'global'
  tags: tags
}

resource cognitiveDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: cognitiveDnsZone
  name: 'link-to-vnet'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: virtualNetworkId
    }
  }
}

resource privateEndpoint 'Microsoft.Network/privateEndpoints@2024-05-01' = {
  name: 'pe-${accountName}'
  location: location
  tags: tags
  properties: {
    subnet: {
      id: privateLinkSubnetId
    }
    privateLinkServiceConnections: [
      {
        name: 'foundry'
        properties: {
          privateLinkServiceId: account.id
          groupIds: [
            'account'
          ]
        }
      }
    ]
  }
}

resource privateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = {
  parent: privateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'services-ai'
        properties: {
          privateDnsZoneId: privateDnsZone.id
        }
      }
      {
        name: 'openai'
        properties: {
          privateDnsZoneId: openAiDnsZone.id
        }
      }
      {
        name: 'cognitiveservices'
        properties: {
          privateDnsZoneId: cognitiveDnsZone.id
        }
      }
    ]
  }
}

output accountName string = account.name
output accountId string = account.id
@description('Azure OpenAI data-plane host for this account. The privatelink.openai.azure.com zone above is what makes this name resolve from inside the VNet.')
output endpoint string = 'https://${accountName}.openai.azure.com'
output deploymentName string = modelDeployment.name
output privateDnsZoneGroupId string = privateDnsZoneGroup.id
