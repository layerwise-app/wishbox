// Layerwise hosts light and dark badges; the `dark` class picks one, and lazy loading
// skips downloading the hidden variant.
export function PoweredByLayerwise() {
  return (
    <a
      href='https://layerwise.app'
      target='_blank'
      rel='noopener'
      className='inline-flex rounded-md transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none'
    >
      <img
        src='https://layerwise.app/powered-by.png'
        alt='Powered by Layerwise'
        width={174}
        height={28}
        loading='lazy'
        className='h-7 w-auto dark:hidden'
      />
      <img
        src='https://layerwise.app/powered-by-dark.png'
        alt='Powered by Layerwise'
        width={174}
        height={28}
        loading='lazy'
        className='hidden h-7 w-auto dark:block'
      />
    </a>
  );
}
