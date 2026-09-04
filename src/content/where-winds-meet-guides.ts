export type GuideStatus = "published" | "needs-review";

export type GuideSection = {
  heading: string;
  paragraphs?: string[];
  items?: string[];
};

export type Guide = {
  slug: string;
  category: string;
  title: string;
  detail: string;
  sections: GuideSection[];
  searchTerms: string[];
  status: GuideStatus;
};

type SupportedLanguage = "th" | "en";

// Content stays separated by game so future titles can receive their own catalog
// without changing the routes or UI used by Where Winds Meet.
export const whereWindsMeetGuides: Record<SupportedLanguage, Guide[]> = {
  th: [
    {
      slug: "tune-gvg",
      category: "Tune",
      title: "พื้นฐานการจัด Tune สำหรับ GVG",
      detail: "ลำดับความสำคัญของ Tune แต่ละชิ้นสำหรับเอาตัวรอดและทำหน้าที่ในทีม",
      status: "published",
      searchTerms: ["Arena Attune", "Serene Breeze", "Tenacity", "หมวก", "เสื้อ", "ขา"],
      sections: [
        { heading: "เริ่มต้นอย่างไร", paragraphs: ["การ Tune สำหรับ GVG ใช้ Arena Attune ซึ่งใช้ดอกไม้สีชมพู ควรเริ่มจากของที่ช่วยให้ทำหน้าที่และเอาตัวรอดได้สม่ำเสมอ ก่อนตามค่าสำหรับเพิ่มดาเมจ"] },
        { heading: "หมวก", items: ["ให้ความสำคัญกับกรอบสีเขียวที่เพิ่มระยะเวลา Tenacity หลังใช้ Serene Breeze เพื่อเพิ่มโอกาสดิ้นหลุดและเอาตัวรอด", "กรอบสีเหลืองที่ลดคูลดาวน์ Serene Breeze 4 วินาที ใช้เป็นตัวเลือกแก้ขัดได้", "กรอบสีแดงไม่อยู่ในลำดับที่แนะนำสำหรับแผนปัจจุบัน"] },
        { heading: "เสื้อและขา", items: ["เสื้อควรเน้นผลลดดาเมจจากการโจมตีที่พบบ่อยในวงไฟต์ เพื่อให้ยืนกับทีมได้นานขึ้น", "ผลลดดาเมจขณะติด Stagger ใช้เป็นตัวเลือกสำรองได้", "ค่า Tune ควรเลือกตามบทบาทจริงของทีม ไม่จำเป็นต้องเหมือนกันทุกคน"] },
      ],
    },
    {
      slug: "mystic-skill",
      category: "Mystic Skill",
      title: "Mystic Skill ที่ควรรู้ก่อนลงสนาม",
      detail: "สกิล AOE สำคัญ ลำดับการอัป และจังหวะที่ควรสื่อสารกับทีม",
      status: "published",
      searchTerms: ["Flaming Meteor", "Lion's Roar", "Bursting Nine", "Flute of the Tides", "Leaping Toad", "AOE"],
      sections: [
        { heading: "ชุด AOE ตั้งต้น", items: ["Flaming Meteor — ลำดับความสำคัญอันดับ 1 แนะนำขั้น 6 แบบอัปเกรดเพื่อเพิ่มรัศมี ใช้ตามจังหวะรวมศัตรูหรือตะลุมบอล", "Lion's Roar — ลำดับความสำคัญอันดับ 2 ช่วยใบ้ ลด Endurance และกระจายพิษจาก Leaping Toad", "Bursting Nine — ใช้ลด Endurance เพื่อจำกัดการกระโดดและการเคลื่อนที่ของศัตรู", "Flute of the Tides — ใช้รับบัพโจมตีหรือช่วยทำดาเมจเมื่อยังเข้าประชิดไม่ได้"] },
        { heading: "สกิลเสริมตามหน้าที่", items: ["Leaping Toad ใช้แปะพิษ และทำงานร่วมกับ Lion's Roar เพื่อระเบิดและกระจายพิษ", "Soaring Spin ช่วยตัดเลือดและเหมาะกับเป้าหมายที่กำลังแบกต้นไม้", "Guardian Palm ใช้ล้มศัตรูและควบคุมพื้นที่ แต่มีช่วงร่ายค่อนข้างนาน", "Dragon Head เหมาะกับทีมบุกและการทำดาเมจวัตถุช่วงต้นเกม"] },
        { heading: "ข้อควรรู้", items: ["ล็อกเป้าก่อนใช้ Flaming Meteor เพื่อให้ลงตรงตำแหน่งที่ต้องการ", "ระวังสิ่งกีดขวางเหนือศีรษะ เพราะอาจทำให้สกิลไปติดหลังคาหรือวัตถุ", "ประกาศจังหวะสกิลสำคัญใน Discord เพื่อให้ทีมตามดาเมจได้พร้อมกัน"] },
      ],
    },
    {
      slug: "ex-skill",
      category: "EX Skill",
      title: "แนวทางเลือก EX Skill ตามบทบาท",
      detail: "หลักคิดสำหรับ DPS, Tank และ Support โดยรอจับคู่ชื่อสกิลกับภาพชุดล่าสุด",
      status: "needs-review",
      searchTerms: ["DPS", "Tank", "Support", "Melee", "Fan", "Umbrella", "Dual Blades", "Whip"],
      sections: [
        { heading: "เลือกจากหน้าที่ ไม่ใช่ชุดตายตัว", items: ["Melee DPS ควรมีเครื่องมือเปิดช่องทำดาเมจ ป้องกันการถูกขัด และช่วยเพิ่มดาเมจในวงที่ทีมกำลังโฟกัส", "Tank ควรเน้นการดึงศัตรู คุมพื้นที่ และสร้างจังหวะให้ DPS ตามได้", "Support ควรเลือกฮีล เกราะ ความเร็วเคลื่อนที่ หรือเครื่องมือช่วยทีมตามหน้าที่ในแผน"] },
        { heading: "สถานะข้อมูล", paragraphs: ["ข้อมูลต้นฉบับหลายรายการใช้รูปเป็นตัวระบุชื่อสกิล จึงยังไม่เผยแพร่การจับคู่ชื่อกับเอฟเฟกต์จนกว่าจะตรวจรูปและ patch ล่าสุด เพื่อป้องกันการแนะนำผิดสกิล"] },
      ],
    },
    {
      slug: "command-skill",
      category: "Command Skill",
      title: "Command Skill และจังหวะเรียกใช้",
      detail: "เลือก Command Skill ให้เหมาะกับสถานการณ์และลดการกดซ้ำในทีม",
      status: "published",
      searchTerms: ["Frontline Zeal", "Sprint", "Relentless Advance", "Last Stand", "Bounty Strike", "City Protection", "Refight"],
      sections: [
        { heading: "บุกและทำลายเป้าหมาย", items: ["Frontline Zeal เพิ่มดาเมจต่อป้อมและห่าน และมีผลตลอด War จึงควรอัปตามทรัพยากร", "You Got a Problem? ใช้เพิ่มดาเมจต่อป้อมในช่วงสั้น เหมาะกับจังหวะเร่งตีเป้าหมาย", "Bounty Strike ใช้เพิ่มดาเมจต่อศัตรูที่กำลังแบกต้นไม้"] },
        { heading: "ช่วยคนแบกและพลิกไฟต์", items: ["Sprint ใช้เพิ่มความเร็วให้คนแบกต้นไม้ในจังหวะสำคัญ", "Relentless Advance ช่วยให้คนแบกไม่ถูกขัดขวางในช่วงที่โดน CC หนัก", "Refight ลดคูลดาวน์ EX Skill ของทีม เหมาะกับจังหวะพลิกเกมที่ตกลงกันไว้"] },
        { heading: "ตั้งรับ", items: ["Last Stand ลดเวลารอเกิด เหมาะกับช่วงที่เวลาเกิดยาวและต้องกลับเข้าพื้นที่เร็ว", "City Protection ทำให้ป้อมและห่านไม่ได้รับดาเมจชั่วคราว ใช้ถ่วงเวลาเมื่อทีมกันบ้านเสียจังหวะ", "กำหนดผู้กดและ call ใน Discord ก่อน เพื่อไม่เสีย Command Point จากการกดซ้ำ"] },
      ],
    },
    {
      slug: "guild-martial-teaching",
      category: "Guild Upgrade",
      title: "Martial Teaching ที่ทุกคนช่วยกันอัป",
      detail: "อัปเกรดส่วนกลางที่สมาชิกทุกคนช่วยกันได้ แม้ไม่ได้ลง Guild War",
      status: "published",
      searchTerms: ["Technique", "Martial Teaching", "Guild Upgrade", "บอส"],
      sections: [
        { heading: "สิ่งที่ต้องทำ", items: ["ไปที่ Technique → Martial Teaching", "อัปทุกช่องที่เป็นรูปหนังสือให้ครบทั้ง 3 แถว", "สมาชิกที่ไม่ได้ลง Guild War ก็ช่วยอัปได้ เพราะเป็นโบนัสรวมของกิลด์"] },
        { heading: "ทำไมจึงสำคัญ", paragraphs: ["โบนัสชุดนี้มีผลกับจังหวะตีบอสสำคัญของ Guild War การช่วยกันอัปจึงลดงานของผู้จัดและทำให้ทั้งกิลด์ได้ประโยชน์ร่วมกัน"] },
      ],
    },
    {
      slug: "battlefield-basics",
      category: "Battlefield",
      title: "อุปกรณ์สนามรบและการใช้ป้อม",
      detail: "สิ่งที่ควรรู้เมื่อรับหน้าที่ป้องกันบ้านหรือใช้อุปกรณ์ในสนาม",
      status: "needs-review",
      searchTerms: ["Bulwark", "Boom Chicken", "Ballista Bolt", "Horskie", "ป้อม", "ไก่ระเบิด"],
      sections: [
        { heading: "อุปกรณ์สนามรบ", items: ["Boom Chicken ใช้วางเป็นกับดักสำหรับช่วยกันพื้นที่บ้าน", "Ballista Bolt และ Horskie มีอยู่ในรายการของกิลด์ แต่รอเพิ่มวิธีใช้จากผู้เล่นที่รับหน้าที่นี้"] },
        { heading: "เมื่อขึ้นป้อม", items: ["ใช้สกิลโจมตีระยะไกลเพื่อขัดและกดดันศัตรูที่เข้ามาในพื้นที่", "สกิลดึงช่วยทำลายจังหวะการบุกและพาศัตรูเข้าใกล้ป้อม", "หมุนป้อมให้หันตามทิศของศัตรู และกระโดดลงก่อนป้อมแตกเพื่อไม่ให้ตายไปพร้อมป้อม"] },
      ],
    },
  ],
  en: [
    {
      slug: "tune-gvg", category: "Tune", title: "GVG tune fundamentals", detail: "Tune priorities for survivability and consistent team roles.", status: "published", searchTerms: ["Arena Attune", "Serene Breeze", "Tenacity", "helmet", "armor"],
      sections: [{ heading: "Getting started", paragraphs: ["GVG uses Arena Attune with pink flowers. Prioritize effects that keep you alive and able to perform your role before chasing extra damage."] }, { heading: "Helmet", items: ["Prioritize the green-frame effect that extends Tenacity after Serene Breeze.", "The yellow-frame 4-second Serene Breeze cooldown reduction is a usable fallback.", "The red-frame effect is not recommended for the current plan."] }, { heading: "Armor and role", items: ["Favor protection against common damage in group fights.", "Stagger damage reduction can be used as a fallback.", "Tune for your assigned role; the whole guild does not need one identical setup."] }],
    },
    {
      slug: "mystic-skill", category: "Mystic Skill", title: "Mystic skills to know before battle", detail: "Important AOE skills, upgrade order, and team callouts.", status: "published", searchTerms: ["Flaming Meteor", "Lion's Roar", "Bursting Nine", "Flute of the Tides", "Leaping Toad", "AOE"],
      sections: [{ heading: "Starter AOE set", items: ["Flaming Meteor — priority 1; upgrade to enhanced tier 6 for a larger radius.", "Lion's Roar — priority 2; helps silence, reduce Endurance, and spread Leaping Toad poison.", "Bursting Nine reduces Endurance and limits enemy movement.", "Flute of the Tides supplies an attack buff or ranged pressure."] }, { heading: "Role options", items: ["Leaping Toad applies poison for Lion's Roar to spread.", "Soaring Spin helps pressure tree carriers.", "Guardian Palm controls space but has a long cast.", "Dragon Head suits attackers and early objective damage."] }, { heading: "Remember", items: ["Lock a target before Flaming Meteor.", "Watch for roofs and overhead obstacles.", "Call important skills in Discord so the team can follow the damage window."] }],
    },
    {
      slug: "ex-skill", category: "EX Skill", title: "Choosing EX skills by role", detail: "A role-first guide awaiting a final name-to-image review.", status: "needs-review", searchTerms: ["DPS", "Tank", "Support", "Melee", "Fan", "Umbrella", "Dual Blades", "Whip"],
      sections: [{ heading: "Build for the job", items: ["Melee DPS needs a safe opening and tools that amplify focused damage.", "Tanks should prioritize pulls and area control.", "Supports can bring healing, shields, movement, or team utility according to the plan."] }, { heading: "Content status", paragraphs: ["Several source entries identify skills by image. Exact skill-to-effect mappings stay unpublished until the images and current patch are reviewed."] }],
    },
    {
      slug: "command-skill", category: "Command Skill", title: "Command skills and call timing", detail: "Match Command Skills to the situation and avoid duplicate casts.", status: "published", searchTerms: ["Frontline Zeal", "Sprint", "Relentless Advance", "Last Stand", "Bounty Strike", "City Protection", "Refight"],
      sections: [{ heading: "Objectives", items: ["Frontline Zeal boosts tower and goose damage throughout the War.", "You Got a Problem? creates a short tower-damage window.", "Bounty Strike pressures the enemy tree carrier."] }, { heading: "Carrier and fight support", items: ["Sprint accelerates the tree carrier.", "Relentless Advance protects the carrier from disruption during heavy CC.", "Refight reduces team EX Skill cooldowns for an agreed comeback window."] }, { heading: "Defense", items: ["Last Stand shortens respawn time.", "City Protection temporarily protects towers and the goose.", "Assign the caller in Discord to avoid wasting Command Points on duplicate casts."] }],
    },
    {
      slug: "guild-martial-teaching", category: "Guild Upgrade", title: "Martial Teaching for every member", detail: "A shared upgrade that everyone can help with, even outside Guild War.", status: "published", searchTerms: ["Technique", "Martial Teaching", "Guild Upgrade", "boss"],
      sections: [{ heading: "What to do", items: ["Open Technique → Martial Teaching.", "Upgrade every book icon across all three rows.", "Members who do not play Guild War can still contribute to this guild-wide bonus."] }, { heading: "Why it matters", paragraphs: ["These shared bonuses help during important Guild War boss timings, so every contribution reduces organizer work and benefits the guild."] }],
    },
    {
      slug: "battlefield-basics", category: "Battlefield", title: "Battlefield items and bulwark basics", detail: "Starter notes for home defense and battlefield equipment.", status: "needs-review", searchTerms: ["Bulwark", "Boom Chicken", "Ballista Bolt", "Horskie", "tower", "trap"],
      sections: [{ heading: "Battlefield items", items: ["Boom Chicken can be placed as a defensive trap.", "Ballista Bolt and Horskie are listed by the guild; usage notes still need an owner review."] }, { heading: "Using a bulwark", items: ["Use the ranged attack to disrupt enemies approaching the area.", "The pull skill can break an enemy push and bring targets toward the tower.", "Rotate toward the enemy and jump off before the tower breaks."] }],
    },
  ],
};
