import { createFileRoute } from '@tanstack/react-router';
import CsvToJson from '../components/CsvToJson';

export const Route = createFileRoute('/csv-to-json')({
  component: CsvToJsonPage,
});

function CsvToJsonPage() {
  return (
    <div className="p-6">
      <CsvToJson />
    </div>
  );
}
