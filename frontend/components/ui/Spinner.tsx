export default function Spinner({ size = 5 }: { size?: number }) {
  return (
    <div
      className={`animate-spin rounded-full border-2 border-gray-300 border-t-uti-blue w-${size} h-${size}`}
    />
  );
}
