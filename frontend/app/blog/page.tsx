import Link from 'next/link';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { getAllPosts } from './lib/posts';
import styles from './page.module.css';

export const metadata = {
  title: 'Resources | Intrinsic',
  description: 'Articles and case studies on financial modeling and valuation.',
};

export default function Blog() {
  const posts = getAllPosts();

  return (
    <div className={styles.container}>
      <Navbar />
      <div className={styles.content}>
        <div className={styles.text}>Resources</div>
        <p className={styles.subtext}>Articles and case studies on financial modeling and valuation.</p>
        <div className={styles.postList}>
          {posts.map(post => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className={styles.postCard}>
              <div className={styles.postMeta}>
                {new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                <span className={styles.dot}>·</span>
                {post.readTime}
              </div>
              <div className={styles.postTitle}>{post.title}</div>
              <div className={styles.postDescription}>{post.description}</div>
            </Link>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
