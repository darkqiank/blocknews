// 跳转到/x
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/x');
}