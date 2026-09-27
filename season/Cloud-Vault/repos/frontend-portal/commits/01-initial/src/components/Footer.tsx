export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} TechVault Inc. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href="/terms" className="text-sm text-gray-500 hover:text-gray-700 transition">
              Terms of Service
            </a>
            <a href="/privacy" className="text-sm text-gray-500 hover:text-gray-700 transition">
              Privacy Policy
            </a>
            <a href="/contact" className="text-sm text-gray-500 hover:text-gray-700 transition">
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
