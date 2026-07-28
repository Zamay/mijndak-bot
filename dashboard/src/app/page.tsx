import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function Home() {
  // Fetch data
  const totalApartments = await prisma.apartment.count()
  const recentApartments = await prisma.apartment.findMany({
    take: 5,
    orderBy: { publishedAt: 'desc' }
  })
  
  const totalApplications = await prisma.application.count()
  const recentApplications = await prisma.application.findMany({
    take: 5,
    orderBy: { appliedAt: 'desc' },
    include: { apartment: true }
  })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex justify-between items-center pb-6 border-b border-gray-200 dark:border-gray-800">
          <h1 className="text-3xl font-bold tracking-tight">MijnDak Dashboard</h1>
          <div className="flex items-center space-x-4">
            <span className="flex items-center text-sm font-medium text-green-500 bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
              Bot Active
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Apartments Found</h3>
            <p className="mt-2 text-4xl font-semibold">{totalApartments}</p>
          </div>
          <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Applications</h3>
            <p className="mt-2 text-4xl font-semibold">{totalApplications}</p>
          </div>
          <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Applications</h3>
            <p className="mt-2 text-4xl font-semibold text-blue-500">
              {recentApplications.filter(a => a.status === 'ACTIVE').length} / 2
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">Recent Apartments</h2>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
              {recentApartments.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No apartments found yet</div>
              ) : (
                recentApartments.map(apt => (
                  <div key={apt.id} className="p-4 flex flex-col sm:flex-row justify-between sm:items-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div>
                      <h4 className="font-medium">{apt.address || 'Unknown Address'}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{apt.district}, {apt.city}</p>
                    </div>
                    <div className="mt-2 sm:mt-0 text-right">
                      <div className="font-semibold text-green-600 dark:text-green-400">€{apt.price}</div>
                      <div className="text-sm text-gray-500">{apt.area}m² • {apt.rooms} kamers</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">Recent Applications</h2>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
              {recentApplications.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No applications yet</div>
              ) : (
                recentApplications.map(app => (
                  <div key={app.id} className="p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div>
                      <h4 className="font-medium">{app.apartment.address}</h4>
                      <p className="text-sm text-gray-500">{new Date(app.appliedAt).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                        app.status === 'ACTIVE' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        app.status === 'WON' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        {app.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
