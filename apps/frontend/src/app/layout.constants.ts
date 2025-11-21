import { Inter, Courier_Prime } from 'next/font/google';

export const inter = Inter({ subsets: ['latin'] });

export const courierPrime = Courier_Prime({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-courier-prime',
  display: 'swap',
});

export const metadata = {
  title: 'BassNotion',
  description: 'Your personal bass guitar learning platform',
};
