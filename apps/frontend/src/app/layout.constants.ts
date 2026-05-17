import {
  Inter,
  Courier_Prime,
  Bebas_Neue,
  DM_Sans,
  DM_Mono,
} from 'next/font/google';
import localFont from 'next/font/local';

export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const podiumSharp = localFont({
  src: '../../public/fonts/PODIUMSharp-2.11.otf',
  variable: '--font-podium-sharp',
  display: 'swap',
});

export const courierPrime = Courier_Prime({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-courier-prime',
  display: 'swap',
});

export const bebasNeue = Bebas_Neue({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-bebas-neue',
  display: 'swap',
});

export const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
});

export const metadata = {
  title: 'Bassicology',
  description: 'Your personal bass guitar learning platform',
};
