import FormClient from './FormClient';

// Server component: pull the publicId out of the route and hand it to the client
// form, which fetches the definition and handles submission.
export default async function FormPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  return <FormClient publicId={publicId} />;
}
