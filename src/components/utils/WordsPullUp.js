import React from 'react';
import { motion } from 'framer-motion';

const WordsPullUp = ({ text, className = '', delay = 0, speed = 0.1 }) => {
    const words = text.split(' ');

    const pullupVariant = {
        initial: { y: '0.5em', opacity: 0 },
        animate: (i) => ({
            y: 0,
            opacity: 1,
            transition: {
                delay: delay + i * speed,
                ease: [.175, .685, .32, 1],
            },
        }),
    };

    return (
        <span className={className}>
      {words.map((word, i) => (
          <motion.span
              key={i}
              style={{ display: 'inline-block', whiteSpace: 'pre' }}
              variants={pullupVariant}
              initial="initial"
              whileInView="animate"
              custom={i}
          >
              {word}
              {i !== words.length - 1 && ' '}
          </motion.span>
      ))}
    </span>
    );
};

export default WordsPullUp;