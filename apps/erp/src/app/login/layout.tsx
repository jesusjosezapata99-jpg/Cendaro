import {
  RootDocumentShell,
  sharedRootMetadata,
  sharedRootViewport,
} from "../_components/root-shell";

export const metadata = sharedRootMetadata;
export const viewport = sharedRootViewport;

export default function LoginRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RootDocumentShell>{children}</RootDocumentShell>;
}
