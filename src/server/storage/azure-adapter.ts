import { DefaultAzureCredential } from "@azure/identity";
import { BlobServiceClient } from "@azure/storage-blob";

import type {
  StorageAdapter,
  StorageContainer,
  StorageWriteMetadata,
  StorageWriteResult,
} from "./adapter";
import { assertValidObjectKey, generateObjectKey } from "./object-key";

export interface AzureBlobStorageAdapterOptions {
  accountName: string;
  sourceDocumentsContainer: string;
  generatedPackagesContainer: string;
}

const CONTAINER_NAME_KEY: Record<StorageContainer, keyof AzureBlobStorageAdapterOptions> = {
  "source-documents": "sourceDocumentsContainer",
  "generated-packages": "generatedPackagesContainer",
};

/**
 * Azure Blob Storage adapter for production. Authenticates exclusively via
 * `DefaultAzureCredential` (managed identity in Azure; falls back through
 * the standard local-dev credential chain outside Azure) — no storage
 * account keys or connection strings are ever read or accepted. Containers
 * are expected to be provisioned as private (no anonymous/public access);
 * this adapter never changes container access level.
 */
export class AzureBlobStorageAdapter implements StorageAdapter {
  readonly provider = "azure" as const;
  private readonly serviceClient: BlobServiceClient;
  private readonly options: AzureBlobStorageAdapterOptions;

  constructor(options: AzureBlobStorageAdapterOptions, credential = new DefaultAzureCredential()) {
    this.options = options;
    this.serviceClient = new BlobServiceClient(
      `https://${options.accountName}.blob.core.windows.net`,
      credential,
    );
  }

  private containerClient(container: StorageContainer) {
    const containerName = this.options[CONTAINER_NAME_KEY[container]];
    return this.serviceClient.getContainerClient(containerName);
  }

  async write(
    container: StorageContainer,
    data: Buffer,
    metadata: StorageWriteMetadata,
  ): Promise<StorageWriteResult> {
    const objectKey = generateObjectKey();
    const blockBlobClient = this.containerClient(container).getBlockBlobClient(objectKey);
    await blockBlobClient.uploadData(data, {
      blobHTTPHeaders: { blobContentType: metadata.contentType },
      metadata: metadata.sourceExpiresAt
        ? { sourceExpiresAt: metadata.sourceExpiresAt.toISOString() }
        : undefined,
    });
    return { objectKey };
  }

  async read(container: StorageContainer, objectKey: string): Promise<Buffer> {
    assertValidObjectKey(objectKey);
    const blockBlobClient = this.containerClient(container).getBlockBlobClient(objectKey);
    const downloaded = await blockBlobClient.downloadToBuffer();
    return downloaded;
  }

  async delete(container: StorageContainer, objectKey: string): Promise<void> {
    assertValidObjectKey(objectKey);
    const blockBlobClient = this.containerClient(container).getBlockBlobClient(objectKey);
    await blockBlobClient.deleteIfExists();
  }

  async exists(container: StorageContainer, objectKey: string): Promise<boolean> {
    assertValidObjectKey(objectKey);
    const blockBlobClient = this.containerClient(container).getBlockBlobClient(objectKey);
    return blockBlobClient.exists();
  }
}
