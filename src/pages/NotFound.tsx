import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 font-mono text-4xl font-extrabold tracking-[-0.02em] text-navy">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Page not found</p>
        <a href="/" className="text-primary underline hover:no-underline">
          Return to Recipe Lab
        </a>
      </div>
    </div>
  );
};

export default NotFound;
