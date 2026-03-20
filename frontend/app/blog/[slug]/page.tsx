import { notFound } from 'next/navigation';
import { getAllPosts, getPost } from '../lib/posts';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import ReactMarkdown from 'react-markdown';
import styles from './article.module.css';

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map(post => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: `${post.title} | Intrinsic`,
    description: post.description,
    alternates: {
      canonical: `https://www.runintrinsic.com/blog/${slug}`,
    },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `https://www.runintrinsic.com/blog/${slug}`,
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    url: `https://www.runintrinsic.com/blog/${slug}`,
    author: {
      '@type': 'Organization',
      name: 'Intrinsic',
      url: 'https://www.runintrinsic.com',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Intrinsic',
      url: 'https://www.runintrinsic.com',
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://www.runintrinsic.com/blog/${slug}`,
    },
  };

  return (
    <div className={styles.container}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />
      <div className={styles.content}>
        <div className={styles.backLinks}>
          <a href="/blog" className={styles.backLink}>← Resources</a>
        </div>
        <div className={styles.meta}>
          {post.date && <span className={styles.metaItem}>{post.date}</span>}
          {post.readTime && <span className={styles.metaItem}>{post.readTime}</span>}
        </div>
        <h1 className={styles.title}>{post.title}</h1>
        {post.description && <p className={styles.description}>{post.description}</p>}
        <div className={styles.body}>
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </div>
      </div>
      <Footer />
    </div>
  );
}
