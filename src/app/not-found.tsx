import Link from "next/link";
import { Building2, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="p-3 bg-gray-100 rounded-full">
            <Building2 className="h-12 w-12 text-gray-400" />
          </div>
        </div>

        {/* Error Message */}
        <div className="space-y-4">
          <h1 className="text-6xl font-bold text-gray-900">404</h1>
          <h2 className="text-2xl font-semibold text-gray-900">
            Página no encontrada
          </h2>
          <p className="text-gray-600">
            Lo sentimos, el recurso que estás buscando no pudo ser encontrado.
          </p>
        </div>

        {/* Action Button */}
        <div className="pt-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors duration-200"
          >
            <Home className="h-5 w-5 mr-2" />
            Volver al inicio
          </Link>
        </div>

        {/* Additional Help Text */}
        <div className="text-sm text-gray-500">
          <p>
            Si crees que esto es un error, por favor contacta al equipo de soporte.
          </p>
        </div>
      </div>
    </div>
  );
}