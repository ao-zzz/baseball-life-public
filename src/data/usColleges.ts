// US colleges with an NCAA Division I baseball program (PROJECT_PLAN §11.15). Name, state and conference as
// listed on the English Wikipedia page 「List of NCAA Division I baseball programs」 (a secondary source, read on
// 2026-10-18; the NCAA's own pages were not used and the rows were not cross-checked one by one). Only Division I
// is collected: Division II and III, the NAIA and the junior colleges (NJCAA) are not, because no list that says
// which schools field a baseball team was found. The strength of a conference is a game assumption.

export interface UsCollege {
  id: string
  name: string
  state: string
  conference: string
}

const RAW = `
University at Albany, The State University of New York | New York | America East
Binghamton University | New York | America East
Bryant University | Rhode Island | America East
University of Maine | Maine | America East
New Jersey Institute of Technology | New Jersey | America East
University of Massachusetts Lowell | Massachusetts | America East
University of Maryland, Baltimore County | Maryland | America East
University of North Carolina at Charlotte | North Carolina | American
East Carolina University | North Carolina | American
Florida Atlantic University | Florida | American
University of Memphis | Tennessee | American
Rice University | Texas | American
University of South Florida | Florida | American
Tulane University | Louisiana | American
University of Alabama at Birmingham | Alabama | American
University of Texas at San Antonio | Texas | American
Wichita State University | Kansas | American
Boston College | Massachusetts | Atlantic Coast
University of California, Berkeley | California | Atlantic Coast
Clemson University | South Carolina | Atlantic Coast
Duke University | North Carolina | Atlantic Coast
Florida State University | Florida | Atlantic Coast
Georgia Institute of Technology | Georgia | Atlantic Coast
University of Louisville | Kentucky | Atlantic Coast
University of Miami | Florida | Atlantic Coast
University of North Carolina at Chapel Hill | North Carolina | Atlantic Coast
North Carolina State University | North Carolina | Atlantic Coast
University of Notre Dame | Indiana | Atlantic Coast
University of Pittsburgh | Pennsylvania | Atlantic Coast
Stanford University | California | Atlantic Coast
University of Virginia | Virginia | Atlantic Coast
Virginia Polytechnic Institute and State University | Virginia | Atlantic Coast
Wake Forest University | North Carolina | Atlantic Coast
Bellarmine University | Kentucky | ASUN
Florida Gulf Coast University | Florida | ASUN
Jacksonville University | Florida | ASUN
Lipscomb University | Tennessee | ASUN
University of North Florida | Florida | ASUN
Queens University of Charlotte | North Carolina | ASUN
Stetson University | Florida | ASUN
Davidson College | North Carolina | Atlantic 10
University of Dayton | Ohio | Atlantic 10
Fordham University | New York | Atlantic 10
George Mason University | Virginia | Atlantic 10
George Washington University | Washington, D.C. | Atlantic 10
La Salle University | Pennsylvania | Atlantic 10
University of Rhode Island | Rhode Island | Atlantic 10
University of Richmond | Virginia | Atlantic 10
St. Bonaventure University | New York | Atlantic 10
Saint Joseph's University | Pennsylvania | Atlantic 10
Saint Louis University | Missouri | Atlantic 10
Virginia Commonwealth University | Virginia | Atlantic 10
Butler University | Indiana | Big East
Creighton University | Nebraska | Big East
Georgetown University | Washington, D.C. | Big East
St. John's University | New York | Big East
Seton Hall University | New Jersey | Big East
University of Connecticut | Connecticut | Big East
Villanova University | Pennsylvania | Big East
Xavier University | Ohio | Big East
Charleston Southern University | South Carolina | Big South
Gardner–Webb University | North Carolina | Big South
High Point University | North Carolina | Big South
Longwood University | Virginia | Big South
Presbyterian College | South Carolina | Big South
Radford University | Virginia | Big South
University of North Carolina at Asheville | North Carolina | Big South
University of South Carolina Upstate | South Carolina | Big South
Winthrop University | South Carolina | Big South
University of Illinois Urbana–Champaign | Illinois | Big Ten
Indiana University Bloomington | Indiana | Big Ten
University of Iowa | Iowa | Big Ten
University of Maryland, College Park | Maryland | Big Ten
University of Michigan | Michigan | Big Ten
Michigan State University | Michigan | Big Ten
University of Minnesota | Minnesota | Big Ten
University of Nebraska–Lincoln | Nebraska | Big Ten
Northwestern University | Illinois | Big Ten
Ohio State University | Ohio | Big Ten
University of Oregon | Oregon | Big Ten
Pennsylvania State University | Pennsylvania | Big Ten
Purdue University | Indiana | Big Ten
Rutgers University | New Jersey | Big Ten
University of California, Los Angeles | California | Big Ten
University of Southern California | California | Big Ten
University of Washington | Washington | Big Ten
University of Arizona | Arizona | Big 12
Arizona State University | Arizona | Big 12
Baylor University | Texas | Big 12
Brigham Young University | Utah | Big 12
University of Cincinnati | Ohio | Big 12
University of Houston | Texas | Big 12
University of Kansas | Kansas | Big 12
Kansas State University | Kansas | Big 12
Oklahoma State University | Oklahoma | Big 12
Texas Christian University | Texas | Big 12
Texas Tech University | Texas | Big 12
University of Central Florida | Florida | Big 12
University of Utah | Utah | Big 12
West Virginia University | West Virginia | Big 12
California Baptist University | California | Big West
California Polytechnic State University | California | Big West
California State University, Fullerton | California | Big West
California State University, Northridge | California | Big West
California State University, Bakersfield | California | Big West
California State University, Long Beach | California | Big West
California State University, Sacramento | California | Big West
University of California, Irvine | California | Big West
University of California, Riverside | California | Big West
University of California, San Diego | California | Big West
University of California, Santa Barbara | California | Big West
Utah Valley University | Utah | Big West
Campbell University | North Carolina | Coastal Athletic
College of Charleston | South Carolina | Coastal Athletic
Elon University | North Carolina | Coastal Athletic
Hofstra University | New York | Coastal Athletic
Monmouth University | New Jersey | Coastal Athletic
North Carolina Agricultural and Technical State University | North Carolina | Coastal Athletic
Northeastern University | Massachusetts | Coastal Athletic
Stony Brook University | New York | Coastal Athletic
Towson University | Maryland | Coastal Athletic
University of North Carolina Wilmington | North Carolina | Coastal Athletic
College of William & Mary | Virginia | Coastal Athletic
University of Delaware | Delaware | Conference USA
Florida International University | Florida | Conference USA
Jacksonville State University | Alabama | Conference USA
Kennesaw State University | Georgia | Conference USA
Liberty University | Virginia | Conference USA
Middle Tennessee State University | Tennessee | Conference USA
Missouri State University | Missouri | Conference USA
New Mexico State University | New Mexico | Conference USA
Sam Houston State University | Texas | Conference USA
Western Kentucky University | Kentucky | Conference USA
University of Wisconsin–Milwaukee | Wisconsin | Horizon League
Northern Illinois University | Illinois | Horizon League
Northern Kentucky University | Kentucky | Horizon League
Oakland University | Michigan | Horizon League
Wright State University | Ohio | Horizon League
Youngstown State University | Ohio | Horizon League
Brown University | Rhode Island | Ivy League
Columbia University | New York | Ivy League
Cornell University | New York | Ivy League
Dartmouth College | New Hampshire | Ivy League
Harvard University | Massachusetts | Ivy League
University of Pennsylvania | Pennsylvania | Ivy League
Princeton University | New Jersey | Ivy League
Yale University | Connecticut | Ivy League
Canisius University | New York | Metro Atlantic
Fairfield University | Connecticut | Metro Atlantic
Iona University | New York | Metro Atlantic
Manhattan University | New York | Metro Atlantic
Marist University | New York | Metro Atlantic
Merrimack College | Massachusetts | Metro Atlantic
Mount St. Mary's University | Maryland | Metro Atlantic
Niagara University | New York | Metro Atlantic
Quinnipiac University | Connecticut | Metro Atlantic
Rider University | New Jersey | Metro Atlantic
Sacred Heart University | Connecticut | Metro Atlantic
Saint Peter's University | New Jersey | Metro Atlantic
Siena University | New York | Metro Atlantic
University of Akron | Ohio | Mid-American
Ball State University | Indiana | Mid-American
Bowling Green State University | Ohio | Mid-American
Central Michigan University | Michigan | Mid-American
Eastern Michigan University | Michigan | Mid-American
Kent State University | Ohio | Mid-American
University of Massachusetts Amherst | Massachusetts | Mid-American
Miami University | Ohio | Mid-American
Ohio University | Ohio | Mid-American
University of Toledo | Ohio | Mid-American
Western Michigan University | Michigan | Mid-American
Belmont University | Tennessee | Missouri Valley
Bradley University | Illinois | Missouri Valley
University of Evansville | Indiana | Missouri Valley
Illinois State University | Illinois | Missouri Valley
Indiana State University | Indiana | Missouri Valley
Murray State University | Kentucky | Missouri Valley
Southern Illinois University Carbondale | Illinois | Missouri Valley
University of Illinois Chicago | Illinois | Missouri Valley
Valparaiso University | Indiana | Missouri Valley
United States Air Force Academy | Colorado | Mountain West
Grand Canyon University | Arizona | Mountain West
University of Hawaiʻi at Mānoa | Hawaii | Mountain West
University of Nevada, Reno | Nevada | Mountain West
University of New Mexico | New Mexico | Mountain West
San Jose State University | California | Mountain West
University of California, Davis | California | Mountain West
University of Nevada, Las Vegas | Nevada | Mountain West
Utah Tech University | Utah | Mountain West
Central Connecticut State University | Connecticut | Northeast Conference
Coppin State University | Maryland | Northeast Conference
Delaware State University | Delaware | Northeast Conference
Fairleigh Dickinson University | New Jersey | Northeast Conference
Le Moyne College | New York | Northeast Conference
Long Island University | New York | Northeast Conference
University of Maryland Eastern Shore | Maryland | Northeast Conference
Norfolk State University | Virginia | Northeast Conference
Stonehill College | Massachusetts | Northeast Conference
Wagner College | New York | Northeast Conference
Eastern Illinois University | Illinois | Ohio Valley
Lindenwood University | Missouri | Ohio Valley
Morehead State University | Kentucky | Ohio Valley
Southeast Missouri State University | Missouri | Ohio Valley
Southern Illinois University Edwardsville | Illinois | Ohio Valley
University of Southern Indiana | Indiana | Ohio Valley
University of Tennessee at Martin | Tennessee | Ohio Valley
Western Illinois University | Illinois | Ohio Valley
Dallas Baptist University | Texas | Pac-12
California State University, Fresno | California | Pac-12
Gonzaga University | Washington | Pac-12
Oregon State University | Oregon | Pac-12
San Diego State University | California | Pac-12
Texas State University | Texas | Pac-12
Washington State University | Washington | Pac-12
United States Military Academy | New York | Patriot League
Bucknell University | Pennsylvania | Patriot League
College of the Holy Cross | Massachusetts | Patriot League
Lafayette College | Pennsylvania | Patriot League
Lehigh University | Pennsylvania | Patriot League
United States Naval Academy | Maryland | Patriot League
University of Alabama | Alabama | Southeastern Conference
University of Arkansas | Arkansas | Southeastern Conference
Auburn University | Alabama | Southeastern Conference
University of Florida | Florida | Southeastern Conference
University of Georgia | Georgia | Southeastern Conference
University of Kentucky | Kentucky | Southeastern Conference
Louisiana State University | Louisiana | Southeastern Conference
University of Mississippi | Mississippi | Southeastern Conference
Mississippi State University | Mississippi | Southeastern Conference
University of Missouri | Missouri | Southeastern Conference
University of Oklahoma | Oklahoma | Southeastern Conference
University of South Carolina | South Carolina | Southeastern Conference
University of Tennessee | Tennessee | Southeastern Conference
University of Texas at Austin | Texas | Southeastern Conference
Texas A&M University | Texas | Southeastern Conference
Vanderbilt University | Tennessee | Southeastern Conference
The Citadel | South Carolina | Southern Conference
East Tennessee State University | Tennessee | Southern Conference
Mercer University | Georgia | Southern Conference
Samford University | Alabama | Southern Conference
Tennessee Tech University | Tennessee | Southern Conference
University of North Carolina at Greensboro | North Carolina | Southern Conference
Virginia Military Institute | Virginia | Southern Conference
Western Carolina University | North Carolina | Southern Conference
Wofford College | South Carolina | Southern Conference
Houston Christian University | Texas | Southland Conference
University of the Incarnate Word | Texas | Southland Conference
Lamar University | Texas | Southland Conference
LSU New Orleans | Louisiana | Southland Conference
McNeese State University | Louisiana | Southland Conference
Nicholls State University | Louisiana | Southland Conference
Northwestern State University | Louisiana | Southland Conference
Southeastern Louisiana University | Louisiana | Southland Conference
Stephen F. Austin State University | Texas | Southland Conference
Texas A&M University–Corpus Christi | Texas | Southland Conference
University of Texas Rio Grande Valley | Texas | Southland Conference
Alabama A&M University | Alabama | SWAC
Alabama State University | Alabama | SWAC
Alcorn State University | Mississippi | SWAC
University of Arkansas at Pine Bluff | Arkansas | SWAC
Bethune–Cookman University | Florida | SWAC
Florida Agricultural and Mechanical University | Florida | SWAC
Grambling State University | Louisiana | SWAC
Jackson State University | Mississippi | SWAC
Mississippi Valley State University | Mississippi | SWAC
Prairie View A&M University | Texas | SWAC
Southern University | Louisiana | SWAC
Texas Southern University | Texas | SWAC
North Dakota State University | North Dakota | Summit League
University of Northern Colorado | Colorado | Summit League
University of Nebraska Omaha | Nebraska | Summit League
Oral Roberts University | Oklahoma | Summit League
University of St. Thomas | Minnesota | Summit League
South Dakota State University | South Dakota | Summit League
Appalachian State University | North Carolina | Sun Belt
Arkansas State University | Arkansas | Sun Belt
Coastal Carolina University | South Carolina | Sun Belt
Georgia Southern University | Georgia | Sun Belt
Georgia State University | Georgia | Sun Belt
James Madison University | Virginia | Sun Belt
University of Louisiana at Lafayette | Louisiana | Sun Belt
University of Louisiana at Monroe | Louisiana | Sun Belt
Louisiana Tech University | Louisiana | Sun Belt
Marshall University | West Virginia | Sun Belt
Old Dominion University | Virginia | Sun Belt
University of South Alabama | Alabama | Sun Belt
University of Southern Mississippi | Mississippi | Sun Belt
Troy University | Alabama | Sun Belt
Abilene Christian University | Texas | United Athletic Conference
Austin Peay State University | Tennessee | United Athletic Conference
University of Central Arkansas | Arkansas | United Athletic Conference
Eastern Kentucky University | Kentucky | United Athletic Conference
University of Arkansas at Little Rock | Arkansas | United Athletic Conference
University of North Alabama | Alabama | United Athletic Conference
Tarleton State University | Texas | United Athletic Conference
University of Texas at Arlington | Texas | United Athletic Conference
Loyola Marymount University | California | West Coast Conference
University of the Pacific | California | West Coast Conference
Pepperdine University | California | West Coast Conference
University of Portland | Oregon | West Coast Conference
Saint Mary's College of California | California | West Coast Conference
University of San Diego | California | West Coast Conference
University of San Francisco | California | West Coast Conference
Santa Clara University | California | West Coast Conference
Seattle University | Washington | West Coast Conference
`

export const US_COLLEGES: UsCollege[] = RAW.trim()
  .split('\n')
  .map((line, i) => {
    const [name, state, conference] = line.split(' | ').map((x) => x.trim())
    return { id: `us-d1-${String(i + 1).padStart(3, '0')}`, name, state, conference }
  })

export const US_COLLEGES_META = { source: 'wikiNcaaD1Baseball', accessed: '2026-10-18', level: 'NCAA Division I', note: 'NCAA 2部・3部、NAIA、短大（NJCAA）は未収録。大学名・州・カンファレンスは二次資料（Wikipedia）の表の転記で、1校ずつの照合はしていない' } as const

/** how strong a conference is relative to an average Japanese university team (a game assumption, not a statistic) */
const CONFERENCE_TIER: Record<string, number> = {
  'Southeastern Conference': 0.8, 'Atlantic Coast': 0.75, 'Big 12': 0.65, 'Big Ten': 0.5, 'Pac-12': 0.5,
  'Sun Belt': 0.3, American: 0.25, 'Big West': 0.25, 'Conference USA': 0.2, 'West Coast Conference': 0.15, 'Mountain West': 0.1,
  'Missouri Valley': 0.1, 'Big East': 0.15, 'Southern Conference': 0.05, 'Southland Conference': 0.05, 'Atlantic 10': 0.05, 'Coastal Athletic': 0.1,
  ASUN: 0.1, 'Big South': 0, 'Mid-American': 0, 'Ivy League': 0, 'Ohio Valley': -0.05, 'United Athletic Conference': -0.05, 'Summit League': -0.1,
  'Horizon League': -0.1, 'Patriot League': -0.1, 'America East': -0.15, 'Metro Atlantic': -0.15, 'Northeast Conference': -0.25, SWAC: -0.25,
}
export const conferenceTier = (c: string): number => CONFERENCE_TIER[c] ?? 0
