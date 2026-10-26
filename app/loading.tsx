import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function Loading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <LoadingSpinner />
      <span className="text-xs font-mono text-neutral-400 mt-3">Loading Digital Heroes...</span>
    </div>
  )
}
