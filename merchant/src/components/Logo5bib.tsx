import Image from 'next/image';

export default function Logo5bib({ className = 'h-9' }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="5BIB"
      width={120}
      height={50}
      className={className}
      style={{ width: 'auto' }}
      priority
    />
  );
}
