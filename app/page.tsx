import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>
      
      <header className="relative px-4 lg:px-6 h-14 flex items-center border-b border-gray-800/50 backdrop-blur-sm z-10">
        <Link href="/" className="flex items-center justify-center">
          <span className="text-xl font-bold gradient-text">BookmarkAI</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Link href="/login" className="text-sm font-medium text-gray-300 hover:text-white transition-smooth hover-lift">
            Login
          </Link>
          <Link href="/signup" className="text-sm font-medium text-gray-300 hover:text-white transition-smooth hover-lift">
            Sign Up
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6 mx-auto max-w-[1400px]">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl/none animate-fade-in">
                <span className="text-white">Welcome to </span>
                <span className="gradient-text">BookmarkAI</span>
              </h1>
              <p className="mx-auto max-w-[700px] text-gray-300 md:text-xl animate-fade-in">
                Organize your bookmarks efficiently with AI-powered summaries and smart organization.
              </p>
              <div className="animate-fade-in">
                <Button 
                  asChild 
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 transition-smooth hover-lift"
                >
                  <Link href="/signup">
                    Get Started <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full py-12 md:py-24 bg-gray-900/50 backdrop-blur-sm">
          <div className="container px-4 md:px-6 mx-auto max-w-[1400px]">
            <div className="grid gap-8 sm:gap-10 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col items-center space-y-4 text-center p-6 rounded-lg bg-gray-800/50 backdrop-blur-sm animate-fade-in">
                <h3 className="text-lg font-bold gradient-text">AI-Powered Summaries</h3>
                <p className="text-gray-300">Get instant summaries of your bookmarked pages using advanced AI technology.</p>
              </div>

              <div className="flex flex-col items-center space-y-4 text-center p-6 rounded-lg bg-gray-800/50 backdrop-blur-sm animate-fade-in">
                <h3 className="text-lg font-bold gradient-text">Smart Organization</h3>
                <p className="text-gray-300">Organize bookmarks with tags and categories for easy access.</p>
              </div>

              <div className="flex flex-col items-center space-y-4 text-center p-6 rounded-lg bg-gray-800/50 backdrop-blur-sm animate-fade-in">
                <h3 className="text-lg font-bold gradient-text">Quick Access</h3>
                <p className="text-gray-300">Find your bookmarks instantly with powerful search and filtering.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
