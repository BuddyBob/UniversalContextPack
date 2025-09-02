import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-bg-secondary border-t border-border-primary mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Section */}
          <div className="md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-accent-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">U</span>
              </div>
              <span className="text-lg font-semibold text-text-primary">Universal Context Pack</span>
            </div>
            <p className="text-text-secondary text-sm max-w-md">
              Transform your AI conversations into portable context packs. Migrate your memory between ChatGPT, Claude, and other AI assistants seamlessly.
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h3 className="text-sm font-medium text-text-primary mb-4">Product</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/process" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
                  Process Files
                </Link>
              </li>
              <li>
                <Link href="/packs" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
                  My Packs
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="text-sm font-medium text-text-primary mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/privacy-policy" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms-of-service" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-border-primary mt-8 pt-6 flex flex-col sm:flex-row justify-between items-center">
          <p className="text-sm text-text-muted">
            © {new Date().getFullYear()} Universal Context Pack. All rights reserved.
          </p>
          <div className="flex space-x-6 mt-4 sm:mt-0">
            <Link href="/privacy-policy" className="text-sm text-text-muted hover:text-text-secondary transition-colors">
              Privacy
            </Link>
            <Link href="/terms-of-service" className="text-sm text-text-muted hover:text-text-secondary transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
