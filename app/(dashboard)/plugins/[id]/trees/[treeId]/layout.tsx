export default function TreeEditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 left-60 z-50 bg-[#0a0a0a]">
      {children}
    </div>
  );
}
