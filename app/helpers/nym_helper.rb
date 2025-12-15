# frozen_string_literal: true

require 'digest'

module NymHelper
  VAPORWAVE_COLORS = %w[#c084fc #7dd3fc #f472b6 #22d3ee #a855f7 #67e8f9 #fb7185].freeze
  ADJECTIVES = %w[orchid cobalt neon velvet crystal aurora lunar coral jade amber indigo cyber amethyst electric sonic midnight prism holo vapor].freeze
  NOUNS = %w[glyph echo comet bloom ember tide pulse flare whisper drone shimmer drift sprite cloud spark quartz nova starling beacon dune kite vector].freeze

  def nym_seed(user, instance = nil)
    instance_id = instance&.id || 0
    Digest::SHA256.hexdigest("#{instance_id}:#{user.id}:#{Rails.application.secret_key_base}")
  end

  def nym_tag(user, instance: nil)
    digest_bytes = [nym_seed(user, instance)].pack('H*').bytes
    adjective = ADJECTIVES[digest_bytes[0] % ADJECTIVES.length]
    noun = NOUNS[digest_bytes[1] % NOUNS.length]
    number = (digest_bytes[2] % 99) + 1

    "nym:#{adjective}-#{noun}-#{number}"
  end

  def nym_glyph_svg(user, instance: nil, size: 32, css_class: 'nym-glyph')
    digest_bytes = [nym_seed(user, instance)].pack('H*').bytes
    primary_color = VAPORWAVE_COLORS[digest_bytes[3] % VAPORWAVE_COLORS.length]
    secondary_color = VAPORWAVE_COLORS[digest_bytes[4] % VAPORWAVE_COLORS.length]

    cells = (0...64).filter_map do |i|
      byte = digest_bytes[i / 8]
      next unless (byte >> (i % 8) & 1) == 1

      color = ((digest_bytes[(i + 5) % digest_bytes.length] & 1) == 1) ? primary_color : secondary_color
      x = i % 8
      y = i / 8
      %(<rect x="#{x}" y="#{y}" width="1" height="1" fill="#{color}" />)
    end

    svg = <<~SVG
      <svg class="#{css_class}" width="#{size}" height="#{size}" viewBox="0 0 8 8" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <rect width="8" height="8" fill="rgba(255,255,255,0.04)" />
        #{cells.join("\n")}
      </svg>
    SVG

    svg.html_safe
  end
end
