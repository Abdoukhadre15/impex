export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen flex items-center justify-center">
      {/* Arrière-plan */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/image-arrière-plan-login.png')" }}
      />
      {/* Overlay sombre */}
      <div className="absolute inset-0 bg-black/60" />
      {/* Contenu */}
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}
