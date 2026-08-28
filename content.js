/* Copy that appears on more than one page. Shared through a plain script tag,
   so the bios exist once rather than three times over. No bundler. */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.METRIS_CONTENT = factory();
})(typeof self !== "undefined" ? self : this, function () {

  var speakerNote = "My colleague Karlos and I lead this session together. He brings twenty-five years of experience inside large organizations, seeing where strategy succeeds, or breaks down, in operations. I build the measurement that shows whether it’s working. Together, we cover both sides of the question: what should you do, and how do you know it worked?";

  var speakers = [
    {
      name: "Suneeta Modekurty",
      role: "Founder and CEO",
      org: "METRIS",
      photo: "suneeta-modekurty.jpg",
      linkedin: "https://www.linkedin.com/in/smodekurty/",
      shortBio: "Suneeta builds the measurement systems behind METRIS, after ten years as a data scientist and bioinformatician inside healthcare, insurance and life sciences companies. She teaches this material as an O\u2019Reilly author and live trainer.",
      bio: [
        "Suneeta Modekurty builds the measurement systems behind METRIS. She spent ten years as a data scientist and bioinformatician inside healthcare, insurance, title and life sciences companies, where the hard part was rarely the model and almost always the question of whether anyone could tell if it was working.",
        "METRIS came out of that. It measures organizational readiness for AI, linking system and workforce readiness to measurable ROI rather than to GRC or models alone. She teaches this material as an O’Reilly author and live trainer, and holds ISO/IEC 27701 and ISO/IEC 42001 Lead Auditor certification.",
        "Before any of it she taught for seventeen years in India. She holds an MS in Bioinformatics from Indiana University, first-authored research presented at ASCO 2024, and reviews manuscripts for PLOS ONE and Frontiers."
      ]
    },
    {
      name: "Karlos Bledsoe Sr.",
      role: "Certified Business and Executive Coach",
      org: "FocalPoint Coaching",
      photo: "karlos-bledsoe.jpg",
      linkedin: "https://www.linkedin.com/in/karlos-bledsoe/",
      shortBio: "Karlos spent more than 25 years at Anheuser-Busch, Edward Jones and BJC, finishing as Director of Strategy and Operations. He now coaches executives on strategy execution and operational performance.",
      bio: [
        "Karlos Bledsoe Sr. is a FocalPoint business and executive coach. He draws on more than 25 years with large companies — Anheuser-Busch, Edward Jones and BJC, where he finished as Director of Strategy and Operations — to help companies overcome challenges, grow and succeed.",
        "He has led strategic planning and strategy execution, data warehousing, data analytics, project management and lean six sigma, across IT, manufacturing, internal consulting and coaching, and sales training.",
        "Karlos is a founding member of the St. Louis chapter of the Society for Information Management, founder of the St. Louis Gateway to Innovation IT conference, and has served on the boards of City Academy School and Great Circle."
      ]
    }
  ];

  var footer = {
    org: "METRIS by SANJEEVANI AI LLC \u00b7 St. Louis, Missouri",
    privacyUrl: "https://www.sanjeevaniai.com/privacy",
    termsUrl: "https://www.sanjeevaniai.com/terms",
    linkedin: "https://www.linkedin.com/company/sanjeevaniai/",
    replyTo: "hello@sanjeevaniai.com"
  };

  return { speakerNote: speakerNote, speakers: speakers, footer: footer };
});
