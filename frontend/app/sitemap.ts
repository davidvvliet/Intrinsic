import { MetadataRoute } from 'next'
import { getAllPosts } from './blog/lib/posts'

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts();

  const postUrls: MetadataRoute.Sitemap = posts.map(post => ({
    url: `https://www.runintrinsic.com/blog/${post.slug}`,
    lastModified: post.date ? new Date(post.date) : new Date(),
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [
    {
      url: 'https://www.runintrinsic.com',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://www.runintrinsic.com/pricing',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://www.runintrinsic.com/blog',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    ...postUrls,
  ]
}
