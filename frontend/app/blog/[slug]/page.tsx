import { getPostBySlug, getAllSlugs } from '@/lib/blog'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Calendar, Clock, ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

interface PageProps {
    params: { slug: string }
}

export async function generateStaticParams() {
    const slugs = getAllSlugs()
    return slugs.map((slug) => ({
        slug,
    }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const post = getPostBySlug(params.slug)

    if (!post) {
        return {
            title: 'Post Not Found',
        }
    }

    return {
        title: `${post.title} - Context Pack Blog`,
        description: post.description,
        openGraph: {
            title: post.title,
            description: post.description,
            type: 'article',
            publishedTime: post.date,
            authors: [post.author],
        },
    }
}

export default function BlogPost({ params }: PageProps) {
    const post = getPostBySlug(params.slug)

    if (!post) {
        notFound()
    }

    return (
        <div className="min-h-screen bg-white pt-32 pb-20">
            {/* Constrained Article Container */}
            <article className="container mx-auto px-4 max-w-[700px]">
                {/* Back Button */}
                <Link
                    href="/blog"
                    className="inline-flex items-center gap-2 text-purple-700 
            hover:text-purple-800 mb-8 transition-colors text-sm font-medium"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Blog
                </Link>

                {/* Header */}
                <header className="mb-12">
                    {/* Category Badge */}
                    <div className="mb-6">
                        <span className="inline-block px-3 py-1.5 bg-purple-50 
              text-purple-700 text-xs font-semibold rounded-full uppercase tracking-wide">
                            {post.category}
                        </span>
                    </div>

                    {/* Title */}
                    <h1 className="text-4xl md:text-5xl font-bold text-black mb-6 leading-tight">
                        {post.title}
                    </h1>

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500 
            pb-6 border-b border-gray-200">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <time dateTime={post.date}>
                                {new Date(post.date).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </time>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>{post.readingTime}</span>
                        </div>
                        <div className="text-gray-600">
                            By {post.author}
                        </div>
                    </div>
                </header>

                {/* Content */}
                <div className="prose prose-lg prose-gray max-w-none">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                        components={{
                            h2: ({ node, ...props }) => <h2 className="text-3xl font-bold text-black mt-16 mb-6" {...props} />,
                            h3: ({ node, ...props }) => <h3 className="text-xl font-semibold text-black mt-10 mb-4" {...props} />,
                            p: ({ node, ...props }) => <p className="text-gray-700 text-lg leading-[1.8] mb-8" {...props} />,
                            ul: ({ node, ...props }) => <ul className="my-8 space-y-3" {...props} />,
                            ol: ({ node, ...props }) => <ol className="my-8 space-y-3" {...props} />,
                            li: ({ node, ...props }) => <li className="text-gray-700 text-lg leading-[1.8]" {...props} />,
                            a: ({ node, ...props }) => <a className="text-purple-700 font-medium hover:text-purple-800 underline decoration-purple-200" {...props} />,
                            strong: ({ node, ...props }) => <strong className="font-semibold text-black" {...props} />,
                            code: ({ node, inline, ...props }: any) =>
                                inline
                                    ? <code className="text-purple-700 bg-purple-50 px-2 py-1 rounded font-mono text-sm" {...props} />
                                    : <code className="block bg-gray-50 p-6 rounded-xl border border-gray-200 overflow-x-auto my-8 text-gray-800 font-mono" {...props} />,
                            blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-purple-700 bg-purple-50 text-gray-700 pl-6 py-6 my-8 rounded-r-lg" {...props} />,
                            hr: ({ node, ...props }) => <hr className="my-12 border-gray-200" {...props} />,
                        }}
                    >
                        {post.content}
                    </ReactMarkdown>
                </div>

                {/* Footer */}
                <footer className="mt-16 pt-8 border-t border-gray-200">
                    <Link
                        href="/blog"
                        className="inline-flex items-center gap-2 text-purple-700 
              hover:text-purple-800 transition-colors font-medium"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to all posts
                    </Link>
                </footer>
            </article>
        </div>
    )
}
