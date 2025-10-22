import { createFileRoute } from '@tanstack/react-router';
import CsvComparition from '../components/CsvComparator';

export const Route = createFileRoute('/csv-comparator')({
  component: CsvComparatorPage,
});

function CsvComparatorPage() {
  return (
    <div className="p-6">
      <CsvComparition />
    </div>
  );
}