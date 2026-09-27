import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <section className="text-center py-16">
          <h1 className="text-4xl font-bold mb-4">
            TechVault Employee Portal
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Internal access to customer vault operations, incident notes, and support tooling.
          </p>
          <div className="flex gap-4 justify-center">
            <a
              href="/login"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
            >
              Sign In
            </a>
            <a
              href="/dashboard"
              className="border border-blue-600 text-blue-600 px-6 py-3 rounded-lg hover:bg-blue-50 transition"
            >
              Operations
            </a>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-8 py-12">
          <div className="p-6 border rounded-lg">
            <h3 className="text-xl font-semibold mb-2">Vault documents</h3>
            <p className="text-gray-600">
              Review customer vault metadata and internal document status.
            </p>
          </div>
          <div className="p-6 border rounded-lg">
            <h3 className="text-xl font-semibold mb-2">Incident notes</h3>
            <p className="text-gray-600">
              Track follow-up work for access reviews and evidence handling.
            </p>
          </div>
          <div className="p-6 border rounded-lg">
            <h3 className="text-xl font-semibold mb-2">Assistant</h3>
            <p className="text-gray-600">
              Ask the internal assistant about TechVault procedures.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
