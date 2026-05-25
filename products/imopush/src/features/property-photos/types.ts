export type AssetTargetKind = 'property-photo'

export type AssetTarget = {
  kind: 'property-photo'
  propertyReference: string
}

export type UploadConstraints = {
  maxBytes: number
  acceptedMimeTypes: readonly string[]
  recommended?: { width: number; height: number; aspectLabel: string }
}
