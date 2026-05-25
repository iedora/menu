import { notFound } from 'next/navigation'
import { getProperty } from '@/shared/data/properties-data'
import { PropertyDetailView } from './property-detail-view'

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ reference: string }>
}) {
  const { reference } = await params
  const prop = await getProperty(reference)
  if (!prop) notFound()

  return <PropertyDetailView prop={prop} reference={reference} />
}
