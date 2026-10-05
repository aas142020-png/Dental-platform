# Block examples (generated)

Generated from `packages/content-schema/src/examples.ts`. Placeholder text only, no clinical content.
Every example passes `parseBlock` with zero issues and round-trips through Postgres in tests.
Envelope: `{ ar?, en?, shared }`. Media references live only in `shared`, always as `{ "asset_id": "<uuid>" }`.

## summary

Valid: yes · issues: 0 · claim links: [{"claim_id":"11111111-1111-4111-8111-111111111111","anchor":"c1"}]

```json
{
  "ar": {
    "heading": "النقاط الرئيسية",
    "points": [
      [
        {
          "type": "text",
          "text": "النقطة الأولى (نص تجريبي)"
        },
        {
          "type": "claim",
          "anchor": "c1"
        }
      ],
      [
        {
          "type": "text",
          "text": "النقطة الثانية"
        }
      ]
    ]
  },
  "en": {
    "heading": "Key points",
    "points": [
      [
        {
          "type": "text",
          "text": "First point (placeholder)"
        },
        {
          "type": "claim",
          "anchor": "c1"
        }
      ],
      [
        {
          "type": "text",
          "text": "Second point"
        }
      ]
    ]
  },
  "shared": {}
}
```

## text

Valid: yes · issues: 0 · claim links: [{"claim_id":"11111111-1111-4111-8111-111111111111","anchor":"c1"},{"claim_id":"22222222-2222-4222-8222-222222222222","anchor":"c2"}]

```json
{
  "ar": {
    "heading": "عنوان القسم",
    "body": [
      {
        "type": "paragraph",
        "children": [
          {
            "type": "text",
            "text": "فقرة تجريبية مع "
          },
          {
            "type": "text",
            "text": "نص عريض",
            "marks": [
              "bold"
            ]
          },
          {
            "type": "text",
            "text": " وادعاء موثق"
          },
          {
            "type": "claim",
            "anchor": "c1"
          },
          {
            "type": "text",
            "text": "."
          }
        ]
      },
      {
        "type": "list",
        "ordered": true,
        "items": [
          [
            {
              "type": "text",
              "text": "عنصر أول"
            }
          ],
          [
            {
              "type": "text",
              "text": "عنصر ثانٍ"
            },
            {
              "type": "claim",
              "anchor": "c2"
            }
          ]
        ]
      }
    ]
  },
  "en": {
    "heading": "Section heading",
    "body": [
      {
        "type": "paragraph",
        "children": [
          {
            "type": "text",
            "text": "Placeholder paragraph with "
          },
          {
            "type": "text",
            "text": "bold text",
            "marks": [
              "bold"
            ]
          },
          {
            "type": "text",
            "text": " and an evidenced statement"
          },
          {
            "type": "claim",
            "anchor": "c1"
          },
          {
            "type": "text",
            "text": "."
          }
        ]
      },
      {
        "type": "list",
        "ordered": true,
        "items": [
          [
            {
              "type": "text",
              "text": "First item"
            }
          ],
          [
            {
              "type": "text",
              "text": "Second item"
            },
            {
              "type": "claim",
              "anchor": "c2"
            }
          ]
        ]
      }
    ]
  },
  "shared": {}
}
```

## illustration

Valid: yes · issues: 0 · claim links: []

```json
{
  "ar": {
    "caption": [
      {
        "type": "text",
        "text": "تعليق الصورة"
      }
    ]
  },
  "en": {
    "caption": [
      {
        "type": "text",
        "text": "Image caption"
      }
    ]
  },
  "shared": {
    "image": {
      "asset_id": "a0000000-0000-4000-8000-000000000001"
    },
    "aspect": "4:3",
    "zoomable": true
  }
}
```

## animation

Valid: yes · issues: 0 · claim links: []

```json
{
  "ar": {
    "caption": [
      {
        "type": "text",
        "text": "تعليق الحركة"
      }
    ],
    "step_labels": [
      "الخطوة 1",
      "الخطوة 2",
      "الخطوة 3"
    ]
  },
  "en": {
    "caption": [
      {
        "type": "text",
        "text": "Animation caption"
      }
    ],
    "step_labels": [
      "Step 1",
      "Step 2",
      "Step 3"
    ]
  },
  "shared": {
    "media": {
      "asset_id": "a0000000-0000-4000-8000-000000000002"
    },
    "poster": {
      "asset_id": "a0000000-0000-4000-8000-000000000003"
    },
    "loop": false
  }
}
```

## interactive_diagram

Valid: yes · issues: 0 · claim links: []

```json
{
  "ar": {
    "caption": [
      {
        "type": "text",
        "text": "مخطط تجريبي"
      }
    ],
    "hotspots": [
      {
        "id": "h1",
        "label": "المنطقة أ"
      },
      {
        "id": "h2",
        "label": "المنطقة ب",
        "description": [
          {
            "type": "paragraph",
            "children": [
              {
                "type": "text",
                "text": "وصف تجريبي"
              }
            ]
          }
        ]
      }
    ]
  },
  "en": {
    "caption": [
      {
        "type": "text",
        "text": "Placeholder diagram"
      }
    ],
    "hotspots": [
      {
        "id": "h1",
        "label": "Region A"
      },
      {
        "id": "h2",
        "label": "Region B",
        "description": [
          {
            "type": "paragraph",
            "children": [
              {
                "type": "text",
                "text": "Placeholder description"
              }
            ]
          }
        ]
      }
    ]
  },
  "shared": {
    "image": {
      "asset_id": "a0000000-0000-4000-8000-000000000004"
    },
    "hotspots": [
      {
        "id": "h1",
        "x": 0.25,
        "y": 0.4
      },
      {
        "id": "h2",
        "x": 0.7,
        "y": 0.55
      }
    ]
  }
}
```

## comparison

Valid: yes · issues: 0 · claim links: [{"claim_id":"11111111-1111-4111-8111-111111111111","anchor":"c1"}]

```json
{
  "ar": {
    "title": "مقارنة",
    "columns": [
      "الخيار أ",
      "الخيار ب"
    ],
    "rows": [
      {
        "label": "الخاصية 1",
        "cells": [
          [
            {
              "type": "text",
              "text": "قيمة"
            }
          ],
          [
            {
              "type": "text",
              "text": "قيمة"
            },
            {
              "type": "claim",
              "anchor": "c1"
            }
          ]
        ]
      },
      {
        "label": "الخاصية 2",
        "cells": [
          [
            {
              "type": "text",
              "text": "قيمة"
            }
          ],
          [
            {
              "type": "text",
              "text": "قيمة"
            }
          ]
        ]
      }
    ]
  },
  "en": {
    "title": "Comparison",
    "columns": [
      "Option A",
      "Option B"
    ],
    "rows": [
      {
        "label": "Attribute 1",
        "cells": [
          [
            {
              "type": "text",
              "text": "Value"
            }
          ],
          [
            {
              "type": "text",
              "text": "Value"
            },
            {
              "type": "claim",
              "anchor": "c1"
            }
          ]
        ]
      },
      {
        "label": "Attribute 2",
        "cells": [
          [
            {
              "type": "text",
              "text": "Value"
            }
          ],
          [
            {
              "type": "text",
              "text": "Value"
            }
          ]
        ]
      }
    ]
  },
  "shared": {}
}
```

## clinical_pearl

Valid: yes · issues: 0 · claim links: [{"claim_id":"11111111-1111-4111-8111-111111111111","anchor":"c1"}]

```json
{
  "ar": {
    "title": "نصيحة",
    "body": [
      {
        "type": "paragraph",
        "children": [
          {
            "type": "text",
            "text": "نص تجريبي للنصيحة"
          },
          {
            "type": "claim",
            "anchor": "c1"
          }
        ]
      }
    ]
  },
  "en": {
    "title": "Pearl",
    "body": [
      {
        "type": "paragraph",
        "children": [
          {
            "type": "text",
            "text": "Placeholder pearl text"
          },
          {
            "type": "claim",
            "anchor": "c1"
          }
        ]
      }
    ]
  },
  "shared": {}
}
```

## warning

Valid: yes · issues: 0 · claim links: [{"claim_id":"22222222-2222-4222-8222-222222222222","anchor":""}]

```json
{
  "ar": {
    "title": "تنبيه",
    "body": [
      {
        "type": "paragraph",
        "children": [
          {
            "type": "text",
            "text": "نص تحذير تجريبي"
          }
        ]
      }
    ]
  },
  "en": {
    "title": "Caution",
    "body": [
      {
        "type": "paragraph",
        "children": [
          {
            "type": "text",
            "text": "Placeholder warning text"
          }
        ]
      }
    ]
  },
  "shared": {
    "severity": "caution"
  }
}
```

## clinical_case

Valid: yes · issues: 0 · claim links: []

```json
{
  "ar": {
    "heading": "حالة"
  },
  "en": {
    "heading": "Case"
  },
  "shared": {
    "case_id": "c0000000-0000-4000-8000-000000000002"
  }
}
```

## quiz

Valid: yes · issues: 0 · claim links: []

```json
{
  "ar": {},
  "en": {
    "heading": "Check yourself"
  },
  "shared": {
    "question_ids": [
      "c0000000-0000-4000-8000-000000000001"
    ]
  }
}
```

## source_list

Valid: yes · issues: 0 · claim links: []

```json
{
  "ar": {
    "heading": "المصادر"
  },
  "en": {
    "heading": "Sources"
  },
  "shared": {
    "mode": "auto"
  }
}
```

## Question version (question_versions columns)

```json
{
  "kind": "single_choice",
  "stem": {
    "ar": "سؤال تجريبي؟",
    "en": "Placeholder question?"
  },
  "options": [
    {
      "id": "a",
      "text": {
        "ar": "الخيار أ",
        "en": "Option A"
      },
      "correct": true
    },
    {
      "id": "b",
      "text": {
        "ar": "الخيار ب",
        "en": "Option B"
      },
      "correct": false
    },
    {
      "id": "c",
      "text": {
        "ar": "الخيار ج",
        "en": "Option C"
      },
      "correct": false
    }
  ],
  "explanation": {
    "ar": "شرح تجريبي",
    "en": "Placeholder explanation"
  },
  "difficulty": 2
}
```

## Case version (case_versions.content)

```json
{
  "ar": {
    "stages": [
      {
        "id": "s1",
        "title": "العرض",
        "prompt": [
          {
            "type": "paragraph",
            "children": [
              {
                "type": "text",
                "text": "نص المرحلة الأولى"
              }
            ]
          }
        ],
        "reveal": [
          {
            "type": "paragraph",
            "children": [
              {
                "type": "text",
                "text": "الكشف الأول"
              }
            ]
          }
        ]
      },
      {
        "id": "s2",
        "prompt": [
          {
            "type": "paragraph",
            "children": [
              {
                "type": "text",
                "text": "نص المرحلة الثانية"
              }
            ]
          }
        ],
        "reveal": [
          {
            "type": "paragraph",
            "children": [
              {
                "type": "text",
                "text": "الكشف الثاني"
              }
            ]
          }
        ]
      }
    ]
  },
  "en": {
    "stages": [
      {
        "id": "s1",
        "title": "Presentation",
        "prompt": [
          {
            "type": "paragraph",
            "children": [
              {
                "type": "text",
                "text": "Stage one text"
              }
            ]
          }
        ],
        "reveal": [
          {
            "type": "paragraph",
            "children": [
              {
                "type": "text",
                "text": "First reveal"
              }
            ]
          }
        ]
      },
      {
        "id": "s2",
        "prompt": [
          {
            "type": "paragraph",
            "children": [
              {
                "type": "text",
                "text": "Stage two text"
              }
            ]
          }
        ],
        "reveal": [
          {
            "type": "paragraph",
            "children": [
              {
                "type": "text",
                "text": "Second reveal"
              }
            ]
          }
        ]
      }
    ]
  },
  "shared": {}
}
```
