import { getAllPosts } from '@/lib/blog'
import Link from 'next/link'
import { Calendar, Clock, ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Blog - Context Pack',
    description: 'Learn about AI memory portability, ChatGPT context management, and cross-platform AI conversations.',
    openGraph: {
        title: 'Blog - Context Pack',
        description: 'Learn about AI memory portability, ChatGPT context management, and cross-platform AI conversations.',
        type: 'website',
    }
}

export default function BlogPage() {
    const posts = getAllPosts()

    return (
        <div className="min-h-screen bg-gray-50 pt-32 pb-20">
            <div className="container mx-auto px-4 max-w-6xl">
                {/* Header */}
                <div className="mb-16">
                    <h1 className="text-5xl md:text-6xl font-bold mb-4 text-black">
                        Blog
                    </h1>
                    <p className="text-lg text-gray-600 max-w-2xl">
                        Guides, tutorials, and insights on AI memory portability
                    </p>
                </div>

                {/* Blog Posts Grid */}
                {posts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {posts.map((post) => (
                            <Link
                                key={post.slug}
                                href={`/blog/${post.slug}`}
                                className="group block h-full"
                            >
                                <article className="h-full bg-white rounded-xl p-6 
                  hover:shadow-lg
                  transition-all duration-200 flex flex-col shadow-sm">

                                    {/* Category Badge */}
                                    <div className="mb-4">
                                        <span className="inline-block px-3 py-1 bg-purple-50 
                      text-purple-700 text-xs font-semibold rounded-full">
                                            {post.category}
                                        </span>
                                    </div>

                                    {/* Title */}
                                    <h2 className="text-xl font-semibold text-black mb-3 
                    group-hover:text-purple-700 transition-colors line-clamp-2">
                                        {post.title}
                                    </h2>

                                    {/* Description */}
                                    <p className="text-gray-600 text-sm mb-4 line-clamp-3 flex-grow">
                                        {post.description}
                                    </p>

                                    {/* Meta */}
                                    <div className="flex items-center gap-4 text-xs text-gray-500 pt-4 border-t border-gray-100">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5" />
                                            <time dateTime={post.date}>
                                                {new Date(post.date).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                })}
                                            </time>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5" />
                                            <span>{post.readingTime}</span>
                                        </div>
                                    </div>

                                    {/* Read More Arrow */}
                                    <div className="mt-4 flex items-center gap-2 text-purple-700 text-sm font-medium">
                                        Read Article
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </article>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-gray-50 border border-gray-200 rounded-xl">
                        <p className="text-gray-600 text-lg">No blog posts yet. Check back soon!</p>
                    </div>
                )}
            </div>
        </div>
    )
}
