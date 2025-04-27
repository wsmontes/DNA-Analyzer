import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import copy from 'rollup-plugin-copy';

export default {
  input: 'js/main.js',
  output: {
    file: 'dist/bundle.js',
    format: 'es',
    sourcemap: true
  },
  plugins: [
    resolve({
      browser: true,
      preferBuiltins: false
    }),
    commonjs(),
    terser(),
    copy({
      targets: [
        { src: 'index.html', dest: 'dist' },
        { src: 'css/**/*', dest: 'dist/css' },
        { src: 'clinvar/**/*', dest: 'dist/clinvar' },
        // Ensure js/lib is properly copied to dist - specify exact path for tabix files
        { src: 'js/lib/tabix.umd.min.js', dest: 'dist/js/lib' },
        { src: 'js/lib/tabix-compat.min.js', dest: 'dist/js/lib' },
        { src: 'js/lib/**/*', dest: 'dist/js/lib' },
        { src: 'js/vcf-worker.js', dest: 'dist/js' }
      ]
    })
  ]
};
