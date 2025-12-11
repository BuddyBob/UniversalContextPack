'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { FileText, ArrowLeft, FolderOpen, CheckCircle, Upload, MessageSquare, Lock, X, Download, Loader, Info } from 'lucide-react'

// Demo data for sample packs
const DEMO_PACKS: Record<string, any> = {
  'sample-1': {
    pack_name: 'Polar Bear Research',
    description: 'Climate impact studies and field observations',
    sources: [
      {
        source_id: 'demo-source-1',
        source_name: 'Arctic Field Notes 2024.txt',
        file_name: 'Arctic Field Notes 2024.txt',
        status: 'analyzed',
        total_chunks: 12,
        processed_chunks: 12
      },
      {
        source_id: 'demo-source-2',
        source_name: 'Climate Data Analysis.pdf',
        file_name: 'Climate Data Analysis.pdf',
        status: 'analyzed',
        total_chunks: 8,
        processed_chunks: 8
      },
      {
        source_id: 'demo-source-3',
        source_name: 'Population Study Results.txt',
        file_name: 'Population Study Results.txt',
        status: 'analyzed',
        total_chunks: 15,
        processed_chunks: 15
      },
      {
        source_id: 'demo-source-4',
        source_name: 'Habitat Observations.txt',
        file_name: 'Habitat Observations.txt',
        status: 'analyzed',
        total_chunks: 6,
        processed_chunks: 6
      },
      {
        source_id: 'demo-source-8',
        source_name: 'gpt_exports.json',
        file_name: 'gpt_exports.json',
        status: 'analyzed',
        total_chunks: 18,
        processed_chunks: 18
      }
    ]
  },
  'sample-2': {
    pack_name: 'Work Notes - Example',
    description: 'Meeting notes and project documentation',
    sources: [
      {
        source_id: 'demo-source-5',
        source_name: 'Q4 Strategy Meeting.txt',
        file_name: 'Q4 Strategy Meeting.txt',
        status: 'analyzed',
        total_chunks: 6,
        processed_chunks: 6
      },
      {
        source_id: 'demo-source-6',
        source_name: 'Product Roadmap Discussion.txt',
        file_name: 'Product Roadmap Discussion.txt',
        status: 'analyzed',
        total_chunks: 7,
        processed_chunks: 7
      },
      {
        source_id: 'demo-source-7',
        source_name: 'Client Feedback Summary.txt',
        file_name: 'Client Feedback Summary.txt',
        status: 'analyzed',
        total_chunks: 9,
        processed_chunks: 9
      }
    ]
  }
}

export default function ResultsPage({ params }: { params: { ucpId: string } }) {
  const { session, user } = useAuth()
  const router = useRouter()
  const [isDemo, setIsDemo] = useState(false)
  const [demoData, setDemoData] = useState<any>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [showChatGPTInfo, setShowChatGPTInfo] = useState(false)

  const handleSignIn = () => {
    // Trigger the auth modal via custom event (same as navbar)
    const authEvent = new CustomEvent('openAuthModal')
    window.dispatchEvent(authEvent)
  }

  useEffect(() => {
    // Check if this is a demo pack
    if (params.ucpId.startsWith('sample-')) {
      setIsDemo(true)
      const packData = DEMO_PACKS[params.ucpId]
      setDemoData(packData)
    } else if (user) {
      // For authenticated users with real packs, redirect to packs page
      router.replace('/packs')
    } else {
      // Non-authenticated users trying to access real packs
      router.replace('/packs')
    }
  }, [params.ucpId, user, router])

  const handleDownloadPack = () => {
    setIsDownloading(true)

    // Generate pack content based on pack type
    const totalChunks = demoData.sources.reduce((sum: number, s: any) => sum + s.total_chunks, 0)

    let packContent = ''

    if (params.ucpId === 'sample-1') {
      packContent = `POLAR BEAR RESEARCH - CONTEXT PACK
Generated: ${new Date().toLocaleDateString()}
Total Sources: 5 | Total Chunks: 59

═══════════════════════════════════════════════════════════════════════

SOURCE 1: Arctic Field Notes 2024.txt
Chunks: 12 | Status: Analyzed

---

CHUNK 1:
Original: Field observations from Svalbard archipelago, March 2024. Temperature readings consistently 3-4°C above historical averages for this period.

Analyzed: Arctic field observations from March 2024 in Svalbard show significant temperature anomalies. Current readings exceed historical averages by 3-4°C, indicating accelerated warming trends in the region. This temperature increase correlates with earlier ice breakup patterns observed across the archipelago.

---

CHUNK 2:
Original: Observed female polar bear with two cubs. Den location approximately 200m from coastline. Cubs appeared healthy, estimated 3-4 months old.

Analyzed: Female polar bear maternal behavior documented with two cubs at coastal den site. Cubs show healthy development at estimated 3-4 months of age. Den proximity to coastline (200m) is notably closer than historical norms, potentially indicating habitat pressure or shifting ice conditions affecting traditional denning locations.

---

CHUNK 3:
Original: Ice thickness measurements: avg 1.2m vs historical 1.8m for this date. Concerning reduction in multi-year ice presence.

Analyzed: Sea ice thickness data reveals significant reduction in ice mass. Current measurements average 1.2 meters compared to historical baseline of 1.8 meters for the same time period, representing a 33% decrease. Multi-year ice, critical for polar bear hunting platforms, shows particularly alarming decline.

---

CHUNK 4:
Original: Prey availability assessment: seal populations appear stable but distribution patterns shifting northward.

Analyzed: Ringed seal population counts remain within normal ranges, however spatial distribution analysis indicates northward migration patterns. This shift potentially impacts polar bear foraging efficiency and energy expenditure, as bears must travel greater distances to access primary prey species.

---

CHUNK 5:
Original: GPS collar data shows increased swimming distances. One male tracked swimming 687km over 9 days, longest recorded distance for this region.

Analyzed: Satellite telemetry reveals unprecedented swimming behavior in male polar bears. Recent GPS tracking documented 687-kilometer swim over nine-day period, establishing new regional record. Extended swimming distances suggest bears are compensating for reduced ice cover by traveling between increasingly fragmented ice floes.

---

CHUNK 6:
Original: Body condition scoring: 60% of observed bears rated 3/5 or below. Lower than expected for post-winter period.

Analyzed: Population health assessment indicates concerning trend in body condition scores. Assessment of observed individuals shows 60% scoring at or below 3 on 5-point scale, representing below-optimal condition for late winter/early spring period. This suggests increased energetic stress, likely related to extended fasting periods due to ice loss.

---

CHUNK 7:
Original: Denning habitat survey: 40% of traditional den sites now within 50m of coastline vs 15% in 1990s data.

Analyzed: Long-term denning habitat analysis reveals significant spatial shift in maternal den locations. Contemporary survey data shows 40% of active dens located within 50 meters of coastline, compared to historical baseline of 15% in 1990s datasets. This coastal concentration may increase vulnerability to storm surges and human disturbance.

---

CHUNK 8:
Original: Behavioral observation: increased time spent on land during summer months. Average 30 more days ashore vs historical patterns.

Analyzed: Summer behavioral patterns show marked temporal shift in land use. Current data indicates polar bears spending approximately 30 additional days on terrestrial habitats compared to historical baselines. This extended terrestrial phase correlates with delayed sea ice formation and earlier spring breakup.

---

CHUNK 9:
Original: Conflict incidents: 12 bear-human encounters reported within 50km of research station, up from 4-5 in previous years.

Analyzed: Human-wildlife conflict metrics indicate increasing interaction frequency. Current season recorded 12 polar bear encounters within research station radius, representing 2.5x increase over previous annual averages of 4-5 encounters. Elevated encounter rates likely reflect bears spending more time in terrestrial environments near human settlements.

---

CHUNK 10:
Original: Cub survival preliminary data: 55% survival to 1 year old, concerning drop from typical 65-70% range.

Analyzed: First-year cub survival rates show statistically significant decline. Preliminary data indicates 55% survival to age one, falling below typical range of 65-70%. Reduced survival rates may reflect maternal nutritional stress, habitat degradation, or increased environmental pressures on cubs during critical early development period.

---

CHUNK 11:
Original: Hair and tissue samples collected from 18 individuals. Lab analysis pending for contaminant loads and dietary isotope signatures.

Analyzed: Biological sampling campaign successfully collected hair and tissue specimens from 18 individuals for comprehensive analysis. Pending laboratory work will assess persistent organic pollutant concentrations and stable isotope ratios to evaluate dietary composition and trophic level changes over time.

---

CHUNK 12:
Original: Project recommendation: increase monitoring frequency in critical denning areas. Consider protective buffer zones around confirmed maternal den sites.

Analyzed: Research team recommends enhanced monitoring protocols for high-value denning habitat. Specific recommendations include increased survey frequency during denning season and establishment of protective buffer zones around confirmed maternal den locations to minimize human disturbance during vulnerable reproductive period.

═══════════════════════════════════════════════════════════════════════

SOURCE 2: Climate Data Analysis.pdf
Chunks: 8 | Status: Analyzed

---

CHUNK 1:
Original: Sea ice extent September 2024: 4.2 million km², second-lowest on record. Only 2012 showed lower extent.

Analyzed: September 2024 sea ice extent measurements establish second-lowest recorded minimum. Arctic Ocean ice coverage reached 4.2 million square kilometers, exceeded only by record minimum in 2012. This continues multi-decadal declining trend in summer sea ice extent, with significant implications for ice-dependent species.

---

CHUNK 2:
Original: Rate of decline: approximately 13% per decade since 1979. Accelerating trend in recent 10-year period.

Analyzed: Long-term trend analysis quantifies sea ice loss rate at approximately 13% per decade since satellite monitoring began in 1979. Recent decade shows acceleration of decline rate, suggesting non-linear response to warming temperatures. This accelerated loss outpaces most climate model predictions from previous generation.

---

CHUNK 3:
Original: First-year ice now comprises 70% of winter maximum vs 40% in 1980s. Multi-year ice essentially collapsed.

Analyzed: Sea ice age composition analysis reveals fundamental shift in Arctic ice characteristics. Contemporary winter maximum ice coverage now consists of 70% first-year ice compared to 40% in 1980s baseline. Virtual collapse of multi-year ice removes critical habitat features relied upon by polar bears for hunting and resting.

---

CHUNK 4:
Original: Ice-free Arctic Ocean projected by 2050 under current emissions trajectory. Some models suggest as early as 2040.

Analyzed: Climate projection models indicate ice-free Arctic summer conditions within coming decades. Under current greenhouse gas emissions trajectory, most models project ice-free conditions by 2050, with some more aggressive models suggesting 2040 threshold. Ice-free defined as less than 1 million square kilometers coverage.

---

CHUNK 5:
Original: Temperature anomaly +2.3°C above 1981-2010 mean for Arctic region. Land areas showing +3.1°C increase.

Analyzed: Arctic surface temperature analysis shows significant warming relative to recent baseline period. Region-wide temperature anomaly measures +2.3°C above 1981-2010 mean, with terrestrial areas experiencing more pronounced warming at +3.1°C. This exemplifies Arctic amplification phenomenon, where polar regions warm faster than global average.

---

CHUNK 6:
Original: Precipitation patterns shifting: increased rainfall events during winter months, historically rare.

Analyzed: Precipitation regime analysis indicates fundamental shift from snow to rain dominance during traditional winter months. Increasing frequency of rainfall events during periods historically characterized by exclusively snow precipitation. Rain-on-snow events create ice layers that can impede prey access for multiple species.

---

CHUNK 7:
Original: Ocean heat content in Arctic increasing. Atlantic Water layer warming driving ice loss from below.

Analyzed: Oceanographic measurements reveal significant heat content increase in Arctic Ocean subsurface layers. Atlantic Water intrusion bringing warmer temperatures at depth, driving bottom-up ice melt mechanism in addition to atmospheric warming. This dual forcing accelerates ice loss beyond surface warming alone.

---

CHUNK 8:
Original: Correlation analysis: polar bear body condition index shows -0.72 correlation with ice-free days (p<0.001).

Analyzed: Statistical analysis establishes strong negative correlation between ice-free period duration and polar bear physiological condition. Body condition index demonstrates correlation coefficient of -0.72 with ice-free days (highly significant at p<0.001), providing quantitative evidence linking habitat loss to individual health outcomes.

═══════════════════════════════════════════════════════════════════════

SOURCE 3: Population Study Results.txt
Chunks: 15 | Status: Analyzed

---

CHUNK 1:
Original: Svalbard population estimate: 264 individuals (95% CI: 221-307). Represents 15% decline from 2015 estimate of 310 individuals.

Analyzed: Mark-recapture population modeling estimates current Svalbard polar bear population at 264 individuals with 95% confidence interval spanning 221-307. This represents statistically significant 15% decline from previous comprehensive survey in 2015 which estimated 310 individuals. Declining trend consistent with deteriorating ice habitat conditions.

---

CHUNK 2:
Original: Sex ratio skewed: 1.4 females per male in adult population. Historical ratio closer to 1:1.

Analyzed: Demographic analysis reveals significant sex ratio bias in adult population segment. Current ratio shows 1.4 females per adult male, deviation from historical approximate parity. Skewed ratio may reflect differential survival or different movement patterns between sexes in response to environmental change.

---

CHUNK 3:
Original: Age structure analysis: reduced recruitment of young adults into population. Gap in 4-7 year age class.

Analyzed: Population age structure reveals concerning recruitment bottleneck. Notable deficit in 4-7 year age class indicates period of reduced cub survival or subadult recruitment occurring 4-7 years prior. This age gap will propagate through population structure, affecting reproductive potential as this cohort reaches breeding age.

---

CHUNK 4:
Original: Reproductive rate: 0.42 cubs per adult female per year, below expected 0.50-0.60 range for healthy population.

Analyzed: Reproductive output analysis indicates suboptimal breeding performance. Current rate of 0.42 cubs per adult female annually falls below expected range of 0.50-0.60 for healthy polar bear populations. Reduced reproductive rate may reflect nutritional stress limiting female ability to successfully breed and raise cubs.

---

CHUNK 5:
Original: Inter-birth interval increasing: average 3.2 years vs historical 2.8 years.

Analyzed: Temporal reproductive pattern analysis shows extended inter-birth intervals. Current average of 3.2 years between successful births represents significant increase from historical norm of 2.8 years. Extended intervals suggest females require longer recovery periods between reproductive attempts, likely due to reduced body condition and nutritional stress.

---

CHUNK 6:
Original: Genetic diversity assessment: heterozygosity within normal range but effective population size declining.

Analyzed: Population genetic analysis indicates maintenance of genetic diversity metrics within expected ranges, however effective population size calculations show declining trend. While current heterozygosity levels remain acceptable, reduced effective population size increases vulnerability to genetic drift and reduces adaptive potential for future environmental change.

---

CHUNK 7:
Original: Immigration/emigration patterns: minimal exchange with neighboring populations. Svalbard functionally isolated.

Analyzed: Movement data analysis indicates limited demographic connectivity with adjacent polar bear populations. Svalbard population demonstrates minimal immigration or emigration, functioning as effectively isolated demographic unit. Limited gene flow reduces rescue effect from neighboring populations and increases vulnerability to local environmental stressors.

---

CHUNK 8:
Original: Survival rates: adult female 0.92, adult male 0.88, subadult 0.85, cub 0.55. All below historical benchmarks.

Analyzed: Survival analysis across age-sex classes reveals across-the-board declines relative to historical data. Adult female annual survival (0.92) traditionally most stable metric now showing reduction. Adult males (0.88), subadults (0.85), and particularly cubs (0.55) all demonstrate survival rates below historical performance benchmarks.

---

CHUNK 9:
Original: Population viability analysis: 40% probability of 50% decline over next 35 years under current conditions.

Analyzed: Stochastic population modeling projects substantial decline risk over coming decades. Population viability analysis incorporating observed vital rates and environmental trends indicates 40% probability of halving current population within 35-year timeframe if conditions continue along current trajectory. This represents high-risk scenario for population persistence.

---

CHUNK 10:
Original: Comparative analysis: Svalbard showing steeper decline than most Arctic populations except southern Beaufort Sea.

Analyzed: Meta-analysis of circumpolar polar bear populations reveals Svalbard among most severely declining populations. Only southern Beaufort Sea population demonstrates comparable or steeper decline trajectory. Geographic variation in population trends correlates strongly with regional differences in sea ice loss patterns and persistence.

---

CHUNK 11:
Original: Density estimates: 0.007 bears/km² of available habitat. Decreased from 0.009 bears/km² in 2015.

Analyzed: Spatial density analysis indicates thinning of population across available habitat. Current estimate of 0.007 individuals per square kilometer represents 22% reduction from 2015 density of 0.009 bears/km². Declining density suggests habitat quality degradation in addition to population size reduction.

---

CHUNK 12:
Original: Movement patterns: increased home range size, particularly for adult males. Average 50% larger than 1990s data.

Analyzed: Satellite telemetry analysis reveals expansion of individual space use patterns. Adult male home ranges currently average 50% larger than ranges documented in 1990s research. Expanded ranges likely reflect need to travel greater distances to access suitable ice habitat and prey resources.

---

CHUNK 13:
Original: Foraging success: kill rate estimates suggest 25% more energy expenditure per successful hunt.

Analyzed: Energetic analysis of foraging behavior indicates decreased hunting efficiency. Current data suggests bears expend approximately 25% more energy per successful prey capture compared to historical estimates. Reduced efficiency likely driven by need to search larger areas and longer distances between ice floes.

---

CHUNK 14:
Original: Long-term prognosis: population unlikely to persist without significant habitat recovery or assisted migration.

Analyzed: Conservation status assessment indicates grave prognosis for Svalbard population under status quo conditions. Analysis suggests population unlikely to maintain viable numbers without either significant recovery of sea ice habitat or implementation of assisted migration to connect with more stable populations. Current trajectory unsustainable.

---

CHUNK 15:
Original: Research priorities: continue long-term monitoring, expand tissue banking, assess climate adaptation potential.

Analyzed: Strategic research recommendations emphasize maintaining long-term demographic monitoring programs, expanding biological specimen collection for future analysis, and investigating potential for behavioral or physiological adaptation to changing conditions. These priorities aim to maximize understanding while population remains viable for study.

═══════════════════════════════════════════════════════════════════════

SOURCE 4: Habitat Observations.txt
Chunks: 6 | Status: Analyzed

---

CHUNK 1:
Original: Ice edge productivity still high but spatial disconnect from bear concentrations. Rich feeding areas 200km+ from ice.

Analyzed: Oceanographic observations indicate maintained high productivity at ice edge zones with abundant prey resources, however spatial analysis reveals increasing disconnect between productive feeding areas and polar bear distributions. Critical prey concentrations now occurring 200+ kilometers from ice margins where bears concentrate, creating energetic bottleneck for foraging.

---

CHUNK 2:
Original: Alternative prey utilization observed: seabird eggs, vegetation, marine algae consumption documented in multiple individuals.

Analyzed: Dietary analysis reveals expansion of polar bear diet to include non-traditional food sources. Multiple individuals documented consuming seabird eggs, terrestrial vegetation, and marine algae. While demonstrating behavioral plasticity, these alternative prey provide inadequate caloric and nutritional value to support polar bear energetic requirements long-term.

---

CHUNK 3:
Original: Denning habitat: coastal erosion affecting 30% of surveyed sites. Storm surge risk increasing for low-elevation dens.

Analyzed: Geomorphological assessment of maternal denning habitat reveals significant degradation of critical reproductive sites. Coastal erosion impacts approximately 30% of surveyed traditional den locations. Rising sea levels and increased storm intensity elevate flooding risk particularly for low-elevation coastal dens, threatening reproductive success.

---

CHUNK 4:
Original: Human infrastructure expansion: tourism, research, resource extraction all increasing in Arctic. Bear habitat increasingly fragmented.

Analyzed: Land use change analysis documents intensifying human footprint across Arctic region. Expansion of tourism operations, scientific research facilities, and natural resource extraction activities creating increasingly fragmented landscape. Human infrastructure development removes denning habitat and creates disturbance corridors that may affect bear movement and space use.

---

CHUNK 5:
Original: Terrestrial habitat characteristics: limited food resources, increased competition with brown bears in coastal areas.

Analyzed: Ecological assessment of terrestrial habitats reveals limited carrying capacity for polar bears during ice-free periods. Available food resources inadequate for sustaining polar bear populations long-term. Increasing range overlap with brown bears in coastal zones creates potential for resource competition and even hybridization in some areas.

---

CHUNK 6:
Original: Future scenarios: under 2°C warming, marginal suitable habitat remains. Under 4°C, effective extinction of ice-dependent behaviors.

Analyzed: Climate scenario modeling projects dramatic range of potential outcomes based on greenhouse gas emissions trajectories. Under moderate warming scenario (+2°C), limited suitable habitat may persist in High Arctic regions. However, under high emissions scenario (+4°C), modeling suggests effective extinction of ice-dependent hunting behaviors as year-round ice habitat disappears.

═══════════════════════════════════════════════════════════════════════

PACK SUMMARY
• Total analyzed text chunks: 41
• Four comprehensive source documents covering field observations, climate data, population dynamics, and habitat assessment
• Research indicates significant population decline (15%), reduced body condition, decreased reproductive success
• Climate data shows accelerating sea ice loss with 13% decline per decade
• Projected population decline of 50% possible within 35 years under current conditions
• Management implications: increased monitoring, protective measures for denning habitat, climate change mitigation critical

END OF CONTEXT PACK`
    } else if (params.ucpId === 'sample-2') {
      packContent = `WORK NOTES - CONTEXT PACK
Generated: ${new Date().toLocaleDateString()}
Total Sources: 3 | Total Chunks: ${totalChunks}

═══════════════════════════════════════════════════════════════════════

SOURCE 1: Q4 Strategy Meeting.txt
Chunks: 6 | Status: Analyzed

---

CHUNK 1:
Original: Q4 priorities focus on product scalability and market expansion. Engineering team to prioritize infrastructure improvements.

Analyzed: Strategic planning for Q4 emphasizes two primary objectives: enhancing product scalability to support growth and expanding market presence. Engineering resources will be allocated toward infrastructure optimization to ensure platform can handle increased user load and feature complexity anticipated in coming quarters.

---

CHUNK 2:
Original: Customer acquisition cost trending upward. Need to optimize marketing spend and improve conversion funnel.

Analyzed: Financial analysis reveals increasing customer acquisition costs, signaling need for strategic intervention. Action items include comprehensive audit of marketing channel effectiveness, conversion funnel optimization, and potential reallocation of budget toward higher-performing channels to improve ROI.

---

CHUNK 3:
Original: Competitive landscape analysis shows two new entrants in our space. Need to accelerate feature roadmap.

Analyzed: Market intelligence indicates intensifying competitive pressure with two new competitors entering market segment. Strategic response requires acceleration of product development timeline, prioritization of differentiating features, and proactive communication of competitive advantages to existing and prospective customers.

---

CHUNK 4:
Original: Team expansion approved for engineering (3 positions) and sales (2 positions). Hiring timeline: complete by end of Q4.

Analyzed: Organizational growth initiative approved with authorization for five new positions across engineering and sales departments. Three engineering roles will focus on backend infrastructure and feature development. Two sales positions will support market expansion efforts. All positions targeted for completion within Q4 timeframe.

---

CHUNK 5:
Original: Partnership discussions with Enterprise Corp progressing. Potential for significant revenue impact if deal closes.

Analyzed: Strategic partnership negotiations with Enterprise Corp advancing through due diligence phase. Successful deal closure would represent substantial revenue opportunity and potential validation of product-market fit in enterprise segment. Deal structure and timeline under active discussion.

---

CHUNK 6:
Original: Board meeting scheduled for October 15. Prepare materials showing Q3 performance and Q4 projections.

Analyzed: Board of directors meeting scheduled mid-October requiring comprehensive performance review. Presentation materials should include detailed Q3 results analysis, key metrics, achievements against targets, and forward-looking Q4 projections with assumptions clearly documented.

═══════════════════════════════════════════════════════════════════════

SOURCE 2: Product Roadmap Discussion.txt
Chunks: 7 | Status: Analyzed

---

CHUNK 1:
Original: Feature request backlog now 230+ items. Need prioritization framework for Q1 2025.

Analyzed: Product backlog has reached 230+ feature requests, necessitating systematic prioritization methodology. Recommendation to implement scoring framework evaluating customer impact, strategic alignment, development effort, and competitive positioning to guide Q1 2025 planning decisions.

---

CHUNK 2:
Original: Mobile app development kicked off. MVP target for January release with core functionality.

Analyzed: Mobile application development initiative launched with minimum viable product targeting January delivery. Initial release will focus on core functionality subset to validate mobile usage patterns and gather user feedback for subsequent iteration planning.

---

CHUNK 3:
Original: API v2 migration planning underway. Breaking changes documented, need customer communication strategy.

Analyzed: API version 2 development progressing with breaking changes identified and documented. Critical need for comprehensive customer communication plan to manage migration timeline, provide technical guidance, and minimize disruption. Consider extended deprecation period and backward compatibility options.

---

CHUNK 4:
Original: Analytics dashboard redesign based on user feedback. Focus on actionable insights rather than raw metrics.

Analyzed: Analytics interface redesign initiative driven by customer feedback analysis. Design philosophy shifting from comprehensive metric display toward curated, actionable insights that directly inform business decisions. User research informing dashboard layout and default views.

---

CHUNK 5:
Original: Integration marketplace idea proposed. Allow third-party developers to build extensions.

Analyzed: Strategic proposal for integration marketplace enabling third-party extension development. Platform approach could accelerate feature availability, create ecosystem effects, and reduce internal development burden. Requires investment in developer documentation, API stability, and marketplace infrastructure.

---

CHUNK 6:
Original: Performance optimization sprint planned for November. Target: reduce page load times by 40%.

Analyzed: Dedicated performance optimization sprint scheduled for November with aggressive target of 40% reduction in page load times. Focus areas include frontend bundle optimization, database query efficiency, CDN configuration, and implementation of lazy loading patterns.

---

CHUNK 7:
Original: Accessibility audit completed. 15 critical issues identified requiring remediation before year end.

Analyzed: Comprehensive accessibility review identified 15 critical compliance issues requiring resolution. Issues span keyboard navigation, screen reader compatibility, and WCAG 2.1 AA standard adherence. Remediation timeline set for year-end completion to ensure inclusive product experience and regulatory compliance.

═══════════════════════════════════════════════════════════════════════

SOURCE 3: Client Feedback Summary.txt
Chunks: 9 | Status: Analyzed

---

CHUNK 1:
Original: Enterprise clients requesting SSO integration. Cited as blocker for 3 potential deals worth $450k ARR.

Analyzed: Enterprise segment feedback identifies Single Sign-On integration as critical missing feature. Sales team reports SSO absence blocking three significant opportunities totaling $450k in annual recurring revenue. Priority feature recommendation given direct revenue impact and enterprise adoption requirement.

---

CHUNK 2:
Original: Support ticket volume up 25% month-over-month. Common themes: onboarding confusion, export functionality.

Analyzed: Customer support metrics indicate 25% increase in ticket volume with pattern analysis revealing two primary pain points. Onboarding process causing user confusion suggests need for improved documentation and in-app guidance. Export functionality issues point to technical limitations requiring product team attention.

---

CHUNK 3:
Original: NPS score 42, up from 38 last quarter. Detractors cite slow feature delivery and missing integrations.

Analyzed: Net Promoter Score improved to 42 from previous quarter's 38, indicating positive trajectory but below industry benchmark. Detractor feedback consistently mentions perceived slow product development pace and limited integration ecosystem, highlighting areas requiring strategic attention.

---

CHUNK 4:
Original: Power users requesting advanced filtering and bulk operations. Willingness to pay for premium tier.

Analyzed: User segment analysis reveals sophisticated power users seeking advanced capabilities including complex filtering and bulk operation support. Notably, this segment expresses willingness to pay premium pricing for enhanced functionality, suggesting tiered product offering opportunity.

---

CHUNK 5:
Original: Mobile usage growing faster than expected. 30% of daily active users now primarily mobile. Need better mobile experience.

Analyzed: Usage analytics reveal unexpected mobile adoption rate with 30% of daily active user base now primarily accessing platform via mobile devices. Current mobile experience not optimized for this usage pattern, creating urgent need for mobile-first design improvements and feature parity.

---

CHUNK 6:
Original: Churn analysis: 60% of cancellations cite 'not enough value' or 'too complicated'. Need better onboarding.

Analyzed: Churn analysis identifies two dominant cancellation reasons: insufficient perceived value and complexity barriers. Combined, these factors account for 60% of churn events, strongly indicating need for improved onboarding experience, better value communication, and reduced learning curve.

---

CHUNK 7:
Original: Feature request: white-labeling for agency partners. 5 agencies interested, potential partnership program.

Analyzed: Agency partner segment requesting white-labeling capability to resell platform under own branding. Five agencies expressed concrete interest, suggesting viable partnership program opportunity. Could unlock new revenue channel through agency reseller network while expanding market reach.

---

CHUNK 8:
Original: Data security questions increasing. Customers asking about SOC 2, GDPR compliance status.

Analyzed: Growing frequency of security and compliance inquiries, particularly regarding SOC 2 certification and GDPR compliance. Indicates market maturation and enterprise customer requirements. Lack of certifications may limit enterprise sales opportunities. Recommend formal compliance initiative.

---

CHUNK 9:
Original: Positive feedback on recent UI updates. Load time improvements noticed and appreciated by users.

Analyzed: Recent user interface updates receiving favorable reception from user base. Performance improvements particularly noted and appreciated, validating investment in optimization efforts. Positive sentiment provides momentum for continued iterative enhancement approach.

═══════════════════════════════════════════════════════════════════════

PACK SUMMARY
• Total analyzed text chunks: ${totalChunks}
• Three comprehensive source documents covering strategic planning, product development, and customer feedback
• Key insights: enterprise features critical for growth, performance and onboarding improvements needed, mobile usage accelerating
• Revenue opportunities: SSO integration blocking $450k ARR, white-labeling potential, premium tier demand identified
• Action priorities: complete Q4 hiring, accelerate roadmap, implement prioritization framework, address churn factors

END OF CONTEXT PACK`
    }

    // Create blob and download
    const blob = new Blob([packContent], { type: 'text/plain' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const filename = params.ucpId === 'sample-1' ? 'Polar_Bear_Research_Context_Pack.txt' : 'Work_Notes_Context_Pack.txt'
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)

    setIsDownloading(false)
  }

  if (!isDemo || !demoData) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Left Sidebar - Sources Panel */}
      <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Pack Header */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <FolderOpen className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <h2 className="text-sm font-semibold text-white truncate">
                {demoData.pack_name}
              </h2>
            </div>
          </div>
          {demoData.description && (
            <p className="text-xs text-gray-500">{demoData.description}</p>
          )}

        </div>

        {/* Sources Header */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-300">SOURCES</h3>
            <span className="text-xs text-gray-500">{demoData.sources.length}</span>
          </div>
        </div>

        {/* Sources List */}
        <div className="flex-1 overflow-y-auto px-4">
          <div className="space-y-2 mt-2">
            {demoData.sources.map((source: any) => (
              <div
                key={source.source_id}
                className="bg-gray-800 rounded-lg p-3 border border-gray-700"
              >
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">
                      {source.source_name || source.file_name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      <CheckCircle className="w-3 h-3 text-green-400 inline mr-1" />
                      {source.total_chunks} chunks
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Middle Panel - Main Content Area */}
      <div className="flex-1 overflow-y-auto flex">
        <div className="flex-1 flex items-center justify-center p-6">
          {/* Add Sources Section */}
          <div className="w-full max-w-3xl">
            {/* Demo Banner */}
            <div className="mb-6 p-4 bg-purple-900/20 border border-purple-800/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-purple-400" />
                  <div>
                    <p className="text-sm font-semibold text-purple-300">This is a Demo Pack</p>
                    <p className="text-sm text-purple-400/80">Sign in to create your own pack with 10 free credits</p>
                  </div>
                </div>
                <button
                  onClick={handleSignIn}
                  className="px-4 py-2 bg-white hover:bg-gray-100 text-black text-sm font-semibold rounded-lg transition-all shadow-lg"
                >
                  Sign In Free
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Add sources</h2>
              <button className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Upload Area */}
            <div className="bg-gray-900/80 border-2 border-gray-600 hover:border-gray-500 rounded-2xl p-10 text-center transition-all duration-300 hover:bg-gray-900/90 mb-6">
              <div className="w-20 h-20 rounded-xl bg-gray-700 flex items-center justify-center mx-auto mb-8">
                <Upload className="h-10 w-10 text-gray-300" />
              </div>

              <h3 className="text-xl font-medium text-white mb-4">Upload sources</h3>

              <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto leading-relaxed">
                Migrate between AIs. Keep your AI’s memory fresh. Build a personal memory system.
              </p>

              <p className="text-xs text-gray-500 flex items-center justify-center gap-1 mt-2">
                <Lock className="h-3 w-3" />
                Sign in to upload sources
              </p>
            </div>

            {/* Source Type Options */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:bg-gray-750 transition-all cursor-not-allowed opacity-60 relative">
                <button
                  onClick={() => setShowChatGPTInfo(!showChatGPTInfo)}
                  className="absolute top-4 right-4 p-1 hover:bg-gray-700 rounded-full transition-colors"
                >
                  <Info className="h-4 w-4 text-gray-400 hover:text-gray-300" />
                </button>

                {showChatGPTInfo && (
                  <div className="absolute top-12 right-4 z-10 w-72 bg-gray-900 border border-gray-700 rounded-lg p-4 shadow-xl">
                    <button
                      onClick={() => setShowChatGPTInfo(false)}
                      className="absolute top-2 right-2 text-gray-500 hover:text-gray-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <h5 className="text-sm font-semibold text-white mb-2">Migrate Your AI Conversations</h5>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Use this to export all your ChatGPT conversations and migrate them to other AI platforms like Claude or Gemini.
                      Simply download your conversations.json from ChatGPT, upload it here, and get a clean context pack you can share with any AI assistant.
                    </p>
                  </div>
                )}

                <div className="w-12 h-12 rounded-lg bg-gray-700 flex items-center justify-center mb-4">
                  <MessageSquare className="h-6 w-6 text-gray-400" />
                </div>
                <h4 className="text-base font-semibold text-white mb-2">All ChatGPT Chats</h4>
                <p className="text-sm text-gray-400 mb-2">conversations.json</p>
                <a href="#" className="text-xs text-blue-400 hover:text-blue-300">How to download →</a>
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:bg-gray-750 transition-all cursor-not-allowed opacity-60">
                <div className="w-12 h-12 rounded-lg bg-gray-700 flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6 text-gray-400" />
                </div>
                <h4 className="text-base font-semibold text-white mb-2">One Chat</h4>
                <p className="text-sm text-gray-400">Import single conversation URL</p>
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:bg-gray-750 transition-all cursor-not-allowed opacity-60">
                <div className="w-12 h-12 rounded-lg bg-gray-700 flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6 text-gray-400" />
                </div>
                <h4 className="text-base font-semibold text-white mb-2">Document</h4>
                <p className="text-sm text-gray-400">PDF, TXT, HTML, CSV</p>
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:bg-gray-750 transition-all cursor-not-allowed opacity-60">
                <div className="w-12 h-12 rounded-lg bg-gray-700 flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6 text-gray-400" />
                </div>
                <h4 className="text-base font-semibold text-white mb-2">Paste Text</h4>
                <p className="text-sm text-gray-400">Direct text input</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Actions Panel */}
      <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Pack Actions</h3>
        </div>

        <div className="flex-1 p-4 space-y-4">
          {/* Download Options */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <FolderOpen className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-md text-white">{demoData.pack_name}</p>
              </div>
            </div>

            <button
              onClick={handleDownloadPack}
              disabled={isDownloading}
              className={`w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden ${!isDownloading
                ? 'after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-gradient-to-r after:from-transparent after:via-green-400 after:to-transparent after:animate-shimmer-slide'
                : ''
                }`}
            >
              {isDownloading ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  <span>Downloading...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>Download Pack</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
