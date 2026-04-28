import { motion, useInView } from 'motion/react'
import { useRef } from 'react'

interface HighlightedTextProps {
  children: React.ReactNode
  delay?: number
}

export function HighlightedText({ children, delay = 0 }: HighlightedTextProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-10% 0px' })

  return (
    <motion.span
      ref={ref}
      style={{ position: 'relative', display: 'inline-flex', overflow: 'hidden', verticalAlign: 'baseline' }}
    >
      <motion.span
        style={{
          position: 'absolute',
          inset: 0,
          left: '-0.1em',
          right: '-0.1em',
          background: '#3FA34D',
          borderRadius: 4,
          zIndex: 0,
        }}
        initial={{ y: '100%' }}
        animate={inView ? { y: '0%' } : { y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 260, delay }}
      />
      <span style={{ position: 'relative', zIndex: 1, color: 'white', paddingLeft: '0.1em', paddingRight: '0.1em' }}>
        {children}
      </span>
    </motion.span>
  )
}
