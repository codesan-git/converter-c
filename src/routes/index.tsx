import { createFileRoute } from '@tanstack/react-router';
import { FileJson, GitCompare } from 'lucide-react';

export const Route = createFileRoute('/')({
  component: Index,
});

function Index() {
  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Welcome to CSV Tools
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Powerful tools untuk mengolah file CSV Anda
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <a
              href="/csv-to-json"
              className="block p-6 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg border-2 border-indigo-200 hover:border-indigo-400 transition group"
            >
              <FileJson className="w-12 h-12 text-indigo-600 mb-4 group-hover:scale-110 transition" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                CSV to JSON Converter
              </h3>
              <p className="text-gray-600 text-sm">
                Convert CSV files ke format JSON dengan mapping custom dan field tambahan
              </p>
            </a>

            <a
              href="/csv-comparator"
              className="block p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border-2 border-green-200 hover:border-green-400 transition group"
            >
              <GitCompare className="w-12 h-12 text-green-600 mb-4 group-hover:scale-110 transition" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                CSV Comparator Pro
              </h3>
              <p className="text-gray-600 text-sm">
                Bandingkan 2 file CSV dengan performa optimal menggunakan Web Worker
              </p>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}