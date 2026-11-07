/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/guardian_vault.json`.
 */
export type GuardianVault = {
  "address": "8vE76ymUvgkQdwBmtQ68kVuaxPvUVN7YymSpSkf3hwtn",
  "metadata": {
    "name": "guardianVault",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Night Guard Wallet: an on-chain vault with trusted contacts, a daily limit, a family guardian and a cooling-off period"
  },
  "instructions": [
    {
      "name": "addTrusted",
      "docs": [
        "Adding a trusted contact needs two signatures: the owner and the guardian.",
        "A scammer who talks the owner into signing still can't add their own wallet."
      ],
      "discriminator": [
        92,
        245,
        167,
        162,
        42,
        90,
        32,
        116
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "guardian",
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "contact",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "cancel",
      "docs": [
        "The owner or the guardian drops a request. Closes it."
      ],
      "discriminator": [
        232,
        219,
        223,
        41,
        219,
        236,
        220,
        190
      ],
      "accounts": [
        {
          "name": "signer",
          "signer": true
        },
        {
          "name": "rentTo",
          "writable": true
        },
        {
          "name": "vault",
          "relations": [
            "req"
          ]
        },
        {
          "name": "req",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "deposit",
      "docs": [
        "Anyone can put money in. Taking it out follows the rules below."
      ],
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.owner",
                "account": "vault"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "execute",
      "docs": [
        "Sends the money of a request, once its rules are met. Closes the request."
      ],
      "discriminator": [
        130,
        221,
        242,
        154,
        13,
        193,
        189,
        29
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          },
          "relations": [
            "req"
          ]
        },
        {
          "name": "req",
          "writable": true
        },
        {
          "name": "to",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "guardianDecide",
      "docs": [
        "The family guardian says yes or no, with an on-chain signature."
      ],
      "discriminator": [
        145,
        121,
        192,
        249,
        6,
        49,
        57,
        34
      ],
      "accounts": [
        {
          "name": "guardian",
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "relations": [
            "req"
          ]
        },
        {
          "name": "req",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "approve",
          "type": "bool"
        }
      ]
    },
    {
      "name": "initialize",
      "docs": [
        "Opens the vault for `owner` and names the family guardian."
      ],
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "guardian",
          "type": "pubkey"
        },
        {
          "name": "dailyLimit",
          "type": "u64"
        },
        {
          "name": "largeAmount",
          "type": "u64"
        },
        {
          "name": "coolingOffSecs",
          "type": "i64"
        }
      ]
    },
    {
      "name": "removeTrusted",
      "docs": [
        "Removing a contact only makes the vault safer, so the owner or the guardian can do it alone."
      ],
      "discriminator": [
        205,
        79,
        181,
        188,
        146,
        18,
        134,
        43
      ],
      "accounts": [
        {
          "name": "signer",
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.owner",
                "account": "vault"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "contact",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "reportScam",
      "docs": [
        "Community scam list: a family guardian reports a wallet that tried to scam their family.",
        "One public record per wallet, counting how many different families reported it; every",
        "Night Guard wallet reads it before signing. Each family can report a wallet only once."
      ],
      "discriminator": [
        217,
        184,
        188,
        131,
        158,
        217,
        227,
        239
      ],
      "accounts": [
        {
          "name": "guardian",
          "writable": true,
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault"
        },
        {
          "name": "report",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  99,
                  97,
                  109
                ]
              },
              {
                "kind": "arg",
                "path": "address"
              }
            ]
          }
        },
        {
          "name": "mark",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  112,
                  111,
                  114,
                  116,
                  101,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "arg",
                "path": "address"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "address",
          "type": "pubkey"
        },
        {
          "name": "reason",
          "type": "u8"
        }
      ]
    },
    {
      "name": "request",
      "docs": [
        "Asks to send money that the everyday path refuses. The chain decides, from its own rules,",
        "whether the guardian must approve and how long the money must wait."
      ],
      "discriminator": [
        46,
        101,
        67,
        11,
        76,
        137,
        12,
        173
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "req",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  113
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "vault.next_request",
                "account": "vault"
              }
            ]
          }
        },
        {
          "name": "to"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "note",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "send",
      "docs": [
        "An everyday payment: goes out at once only to a trusted contact, under the daily limit",
        "and below the \"large amount\". Anything else is refused by the chain."
      ],
      "discriminator": [
        102,
        251,
        20,
        187,
        65,
        75,
        12,
        69
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "to",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "setLimits",
      "docs": [
        "Changing the limits needs both signatures."
      ],
      "discriminator": [
        207,
        50,
        250,
        67,
        211,
        33,
        70,
        91
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "guardian",
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "dailyLimit",
          "type": "u64"
        },
        {
          "name": "largeAmount",
          "type": "u64"
        },
        {
          "name": "coolingOffSecs",
          "type": "i64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "reportMark",
      "discriminator": [
        247,
        225,
        13,
        195,
        39,
        153,
        158,
        132
      ]
    },
    {
      "name": "scamReport",
      "discriminator": [
        19,
        17,
        184,
        47,
        228,
        134,
        81,
        237
      ]
    },
    {
      "name": "transferRequest",
      "discriminator": [
        200,
        121,
        88,
        202,
        12,
        160,
        237,
        12
      ]
    },
    {
      "name": "vault",
      "discriminator": [
        211,
        8,
        232,
        43,
        2,
        152,
        117,
        119
      ]
    }
  ],
  "events": [
    {
      "name": "cancelled",
      "discriminator": [
        136,
        23,
        42,
        65,
        143,
        233,
        234,
        46
      ]
    },
    {
      "name": "executed",
      "discriminator": [
        8,
        232,
        139,
        132,
        197,
        45,
        29,
        164
      ]
    },
    {
      "name": "guardianDecided",
      "discriminator": [
        137,
        208,
        28,
        194,
        64,
        212,
        8,
        44
      ]
    },
    {
      "name": "limitsChanged",
      "discriminator": [
        124,
        11,
        98,
        161,
        150,
        103,
        33,
        110
      ]
    },
    {
      "name": "requestOpened",
      "discriminator": [
        105,
        212,
        86,
        97,
        100,
        83,
        195,
        82
      ]
    },
    {
      "name": "scamReported",
      "discriminator": [
        86,
        101,
        162,
        121,
        87,
        222,
        167,
        5
      ]
    },
    {
      "name": "sent",
      "discriminator": [
        230,
        90,
        111,
        254,
        186,
        174,
        45,
        74
      ]
    },
    {
      "name": "trustedChanged",
      "discriminator": [
        22,
        114,
        100,
        162,
        76,
        251,
        51,
        106
      ]
    },
    {
      "name": "vaultOpened",
      "discriminator": [
        198,
        250,
        195,
        25,
        26,
        107,
        197,
        16
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "notTrusted",
      "msg": "This wallet is not on your trusted contacts list"
    },
    {
      "code": 6001,
      "name": "overDailyLimit",
      "msg": "This goes over today's limit"
    },
    {
      "code": 6002,
      "name": "needsCoolingOff",
      "msg": "Big amount: it must wait the cooling-off period"
    },
    {
      "code": 6003,
      "name": "needsGuardian",
      "msg": "The family guardian has to approve this first"
    },
    {
      "code": 6004,
      "name": "stillCoolingOff",
      "msg": "Still in the cooling-off period"
    },
    {
      "code": 6005,
      "name": "rejected",
      "msg": "The family guardian said no"
    },
    {
      "code": 6006,
      "name": "notPending",
      "msg": "This request was already decided"
    },
    {
      "code": 6007,
      "name": "wrongDestination",
      "msg": "Destination does not match the request"
    },
    {
      "code": 6008,
      "name": "notEnoughMoney",
      "msg": "Not enough money in the vault"
    },
    {
      "code": 6009,
      "name": "notAllowed",
      "msg": "Only the owner or the guardian can do this"
    },
    {
      "code": 6010,
      "name": "guardianIsOwner",
      "msg": "The guardian must be someone else"
    },
    {
      "code": 6011,
      "name": "alreadyTrusted",
      "msg": "Contact already trusted"
    },
    {
      "code": 6012,
      "name": "tooManyContacts",
      "msg": "Too many trusted contacts"
    },
    {
      "code": 6013,
      "name": "badSettings",
      "msg": "Invalid settings"
    },
    {
      "code": 6014,
      "name": "zeroAmount",
      "msg": "Amount must be more than zero"
    }
  ],
  "types": [
    {
      "name": "cancelled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "request",
            "type": "pubkey"
          },
          {
            "name": "by",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "executed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "request",
            "type": "pubkey"
          },
          {
            "name": "to",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "guardianDecided",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "request",
            "type": "pubkey"
          },
          {
            "name": "approve",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "limitsChanged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "dailyLimit",
            "type": "u64"
          },
          {
            "name": "largeAmount",
            "type": "u64"
          },
          {
            "name": "coolingOffSecs",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "reportMark",
      "docs": [
        "Marks that one family (vault) already reported an address, so it counts once."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "requestOpened",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "request",
            "type": "pubkey"
          },
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "to",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "needsGuardian",
            "type": "bool"
          },
          {
            "name": "unlockAt",
            "type": "i64"
          },
          {
            "name": "trusted",
            "type": "bool"
          },
          {
            "name": "overLimit",
            "type": "bool"
          },
          {
            "name": "large",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "scamReport",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "address",
            "type": "pubkey"
          },
          {
            "name": "reports",
            "type": "u32"
          },
          {
            "name": "firstAt",
            "type": "i64"
          },
          {
            "name": "lastAt",
            "type": "i64"
          },
          {
            "name": "lastReason",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "scamReported",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "address",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "reports",
            "type": "u32"
          },
          {
            "name": "reason",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "sent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "to",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "transferRequest",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "to",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "unlockAt",
            "type": "i64"
          },
          {
            "name": "needsGuardian",
            "type": "bool"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "note",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "trustedChanged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "contact",
            "type": "pubkey"
          },
          {
            "name": "added",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "vault",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "guardian",
            "type": "pubkey"
          },
          {
            "name": "dailyLimit",
            "type": "u64"
          },
          {
            "name": "largeAmount",
            "type": "u64"
          },
          {
            "name": "coolingOffSecs",
            "type": "i64"
          },
          {
            "name": "day",
            "type": "i64"
          },
          {
            "name": "spentToday",
            "type": "u64"
          },
          {
            "name": "nextRequest",
            "type": "u64"
          },
          {
            "name": "trusted",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "vaultOpened",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "guardian",
            "type": "pubkey"
          },
          {
            "name": "dailyLimit",
            "type": "u64"
          },
          {
            "name": "largeAmount",
            "type": "u64"
          },
          {
            "name": "coolingOffSecs",
            "type": "i64"
          }
        ]
      }
    }
  ]
};
