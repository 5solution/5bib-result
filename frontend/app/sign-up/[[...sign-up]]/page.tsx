import { SignUp } from '@clerk/nextjs';

export default function Page() {
  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center p-4">
      <SignUp />
    </div>
  );
}
